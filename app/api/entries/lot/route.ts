import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { v4 as uuid } from "uuid";
import { authOptions } from "@/lib/auth";
import { getBigQuery, table, currentReconMonth } from "@/lib/bigquery";
import type { LotEntryInput } from "@/lib/types";

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
      SELECT lot_no, location, gemstone, no_of_pcs, total_carat_ct, comments, submitted_by, submitted_at
      FROM ${table("lot_entries")}
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

  const entry = (await req.json()) as LotEntryInput;
  if (!entry?.lot_no || !entry.location || !entry.gemstone) {
    return NextResponse.json({ error: "lot_no, location and gemstone are required" }, { status: 400 });
  }

  const bq = getBigQuery();
  const reconMonth = currentReconMonth();

  // Simple duplicate check: this Lot No. must not already exist this month.
  const existingQuery = `
    SELECT lot_no
    FROM ${table("lot_entries")}
    WHERE recon_month = @reconMonth AND lot_no = @lotNo
    LIMIT 1
  `;
  const [existingRows] = await bq.query({
    query: existingQuery,
    params: { reconMonth, lotNo: entry.lot_no }
  });

  if (existingRows.length > 0) {
    return NextResponse.json(
      { error: `Lot No. ${entry.lot_no} is already present in database` },
      { status: 409 }
    );
  }

  const row = {
    entry_id: uuid(),
    lot_no: entry.lot_no,
    location: entry.location,
    gemstone: entry.gemstone,
    no_of_pcs: entry.no_of_pcs,
    total_carat_ct: entry.total_carat_ct,
    comments: entry.comments ?? null,
    submitted_by: session.user?.email,
    submitted_at: new Date().toISOString(),
    recon_month: reconMonth
  };

  await bq.dataset(process.env.BIGQUERY_DATASET!).table("lot_entries").insert([row]);

  return NextResponse.json({ submitted: 1 });
}
