import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBigQuery, table, currentReconMonth } from "@/lib/bigquery";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bq = getBigQuery();
  const requestedMonth = req.nextUrl.searchParams.get("month");
  // Accept only a well-formed YYYY-MM-01 value; anything else falls back to
  // the current month rather than passing unvalidated input to BigQuery.
  const reconMonth = requestedMonth && /^\d{4}-\d{2}-01$/.test(requestedMonth) ? requestedMonth : currentReconMonth();

  const query = `
    SELECT
      (SELECT COUNT(*) FROM ${table("normal_entries")}
        WHERE submitted_by = @email AND recon_month = @reconMonth) AS normal_count,
      (SELECT COUNT(*) FROM ${table("lot_entries")}
        WHERE submitted_by = @email AND recon_month = @reconMonth) AS lot_count,
      (SELECT COUNT(*) FROM ${table("no_pkt_entries")}
        WHERE submitted_by = @email AND recon_month = @reconMonth) AS no_pkt_count
  `;
  const [rows] = await bq.query({
    query,
    params: { email: session.user.email, reconMonth }
  });

  const row = rows[0] ?? { normal_count: 0, lot_count: 0, no_pkt_count: 0 };
  return NextResponse.json({
    reconMonth,
    normalCount: Number(row.normal_count),
    lotCount: Number(row.lot_count),
    noPktCount: Number(row.no_pkt_count)
  });
}
