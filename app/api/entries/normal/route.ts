import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { v4 as uuid } from "uuid";
import { authOptions } from "@/lib/auth";
import { getBigQuery, table, currentReconMonth } from "@/lib/bigquery";
import { validateNormalEntries } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const requestedMonth = req.nextUrl.searchParams.get("month");
  const reconMonth = requestedMonth && /^\d{4}-\d{2}-01$/.test(requestedMonth) ? requestedMonth : currentReconMonth();

  // Every signed-in user can see every submission for the month -- the
  // personal views filter this same response down to "my entries" client
  // side; the "All Entries" views show it as-is.
  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT entry_number, packet_no, gemstone, submitted_by, submitted_at
      FROM ${table("normal_entries")}
      WHERE recon_month = @reconMonth
      ORDER BY submitted_at DESC
    `,
    params: { reconMonth }
  });

  return NextResponse.json({ entries: rows, reconMonth });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { packet_no, gemstone, entry_numbers } = await req.json();
  if (!packet_no || !gemstone || !Array.isArray(entry_numbers) || entry_numbers.length === 0) {
    return NextResponse.json(
      { error: "packet_no, gemstone and entry_numbers are required" },
      { status: 400 }
    );
  }

  const reconMonth = currentReconMonth();

  // Always re-validate server-side — never trust a client-reported "all clear".
  const results = await validateNormalEntries(packet_no, entry_numbers, reconMonth);
  const allValid = results.every((r) => r.valid);

  if (!allValid) {
    return NextResponse.json({ submitted: 0, results }, { status: 200 });
  }

  const bq = getBigQuery();
  const rows = results.map((r) => ({
    entry_id: uuid(),
    entry_number: r.entry_number,
    packet_no,
    gemstone,
    submitted_by: session.user?.email,
    submitted_at: new Date().toISOString(),
    recon_month: reconMonth
  }));

  await bq.dataset(process.env.BIGQUERY_DATASET!).table("normal_entries").insert(rows);

  return NextResponse.json({ submitted: rows.length, results });
}
