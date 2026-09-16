import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { v4 as uuid } from "uuid";
import { authOptions } from "@/lib/auth";
import { getBigQuery, table, currentReconMonth } from "@/lib/bigquery";
import { validateNoPktEntries } from "@/lib/validation";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const role = ((session.user as any).role ?? "member") as string;
  const requestedMonth = req.nextUrl.searchParams.get("month");
  const reconMonth = requestedMonth && /^\d{4}-\d{2}-01$/.test(requestedMonth) ? requestedMonth : currentReconMonth();

  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT entry_number, location, gemstone, submitted_by, submitted_at
      FROM ${table("no_pkt_entries")}
      WHERE recon_month = @reconMonth
        AND (@role = 'admin' OR submitted_by = @email)
      ORDER BY submitted_at DESC
    `,
    params: { reconMonth, role, email: session.user.email }
  });

  return NextResponse.json({ entries: rows, reconMonth });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { location, gemstone, entry_numbers } = await req.json();
  if (!location || !gemstone || !Array.isArray(entry_numbers) || entry_numbers.length === 0) {
    return NextResponse.json(
      { error: "location, gemstone and entry_numbers are required" },
      { status: 400 }
    );
  }

  const reconMonth = currentReconMonth();
  const results = await validateNoPktEntries(entry_numbers, reconMonth);
  const allValid = results.every((r) => r.valid);

  if (!allValid) {
    return NextResponse.json({ submitted: 0, results }, { status: 200 });
  }

  const bq = getBigQuery();
  const rows = results.map((r) => ({
    entry_id: uuid(),
    entry_number: r.entry_number,
    location,
    gemstone,
    submitted_by: session.user?.email,
    submitted_at: new Date().toISOString(),
    recon_month: reconMonth
  }));

  await bq.dataset(process.env.BIGQUERY_DATASET!).table("no_pkt_entries").insert(rows);

  return NextResponse.json({ submitted: rows.length, results });
}
