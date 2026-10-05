import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBigQuery, table, currentReconMonth } from "@/lib/bigquery";

// For Entry (normal_entries) and No Pkt No. (no_pkt_entries) are the same
// shape apart from one column -- packet_no vs location -- so an inventory
// team member shouldn't have to check both tables separately to find an
// Inventory ID. This unions both for the month and tags each row with
// which form it came from.
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const requestedMonth = req.nextUrl.searchParams.get("month");
  const reconMonth = requestedMonth && /^\d{4}-\d{2}-01$/.test(requestedMonth) ? requestedMonth : currentReconMonth();

  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT entry_number, packet_no, CAST(NULL AS STRING) AS location, gemstone, submitted_by, submitted_at, 'For Entry' AS source
      FROM ${table("normal_entries")}
      WHERE recon_month = @reconMonth

      UNION ALL

      SELECT entry_number, CAST(NULL AS STRING) AS packet_no, location, gemstone, submitted_by, submitted_at, 'No Pkt No.' AS source
      FROM ${table("no_pkt_entries")}
      WHERE recon_month = @reconMonth

      ORDER BY submitted_at DESC
    `,
    params: { reconMonth }
  });

  return NextResponse.json({ entries: rows, reconMonth });
}
