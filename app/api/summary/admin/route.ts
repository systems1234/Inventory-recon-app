import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBigQuery, table, currentReconMonth, employeeTable, finalInventoryMasterTable } from "@/lib/bigquery";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const role = (session?.user as any)?.role;
  if (!session || role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const bq = getBigQuery();
  const requestedMonth = req.nextUrl.searchParams.get("month");
  const reconMonth = requestedMonth && /^\d{4}-\d{2}-01$/.test(requestedMonth) ? requestedMonth : currentReconMonth();

  // Only people who actually submitted something this month -- the users
  // table also holds admins/managers who never do reconciliation.
  const membersQuery = `
    WITH submissions AS (
      SELECT LOWER(submitted_by) AS email, 'normal' AS kind FROM ${table("normal_entries")} WHERE recon_month = @reconMonth
      UNION ALL
      SELECT LOWER(submitted_by), 'lot' FROM ${table("lot_entries")} WHERE recon_month = @reconMonth
      UNION ALL
      SELECT LOWER(submitted_by), 'no_pkt' FROM ${table("no_pkt_entries")} WHERE recon_month = @reconMonth
    ),
    counts AS (
      SELECT email,
             COUNTIF(kind = 'normal') AS normal_count,
             COUNTIF(kind = 'lot') AS lot_count,
             COUNTIF(kind = 'no_pkt') AS no_pkt_count
      FROM submissions
      GROUP BY email
    )
    SELECT c.email AS user_id,
           COALESCE(ANY_VALUE(e.display_name), ANY_VALUE(u.name), c.email) AS name,
           c.normal_count, c.lot_count, c.no_pkt_count
    FROM counts c
    LEFT JOIN ${employeeTable()} e ON LOWER(e.work_email) = c.email
    LEFT JOIN ${table("users")} u ON LOWER(u.user_id) = c.email
    GROUP BY c.email, c.normal_count, c.lot_count, c.no_pkt_count
    ORDER BY c.normal_count + c.lot_count + c.no_pkt_count DESC
  `;

  // Same universe as the "IMS Instock - Loose, but missed in Recon" view:
  // Instock - Loose items that existed in IMS by the 5th of the month.
  const coverageQuery = `
    WITH recon AS (
      SELECT DISTINCT TRIM(CAST(entry_number AS STRING)) AS id
      FROM (
        SELECT entry_number FROM ${table("normal_entries")} WHERE recon_month = @reconMonth
        UNION ALL
        SELECT entry_number FROM ${table("no_pkt_entries")} WHERE recon_month = @reconMonth
      )
    ),
    cutoff AS (
      -- Recon covers IMS stock as it stood on the 5th of the month; later IMS
      -- additions (and scans made afterwards to solve cases) don't move it.
      SELECT DATE_ADD(CAST(@reconMonth AS DATE), INTERVAL 4 DAY) AS d
    ),
    loose AS (
      SELECT TRIM(CAST(i.Int_mas_Inventory_ID AS STRING)) AS id,
             IFNULL(i.Final_Formula_Based_Price, 0) AS price
      FROM ${finalInventoryMasterTable()} i
      CROSS JOIN cutoff c
      WHERE UPPER(REGEXP_REPLACE(TRIM(i.Final_Inventory_Status), r'\\s+', ' ')) = 'INSTOCK - LOOSE'
        AND DATE(i.Int_mas_Timestamp) <= c.d
    )
    SELECT
      COUNT(*) AS total_items,
      COUNTIF(r.id IS NOT NULL) AS verified_items,
      CAST(IFNULL(SUM(l.price), 0) AS FLOAT64) AS total_value,
      CAST(IFNULL(SUM(IF(r.id IS NULL, l.price, 0)), 0) AS FLOAT64) AS unverified_value
    FROM loose l
    LEFT JOIN recon r ON r.id = l.id
  `;

  try {
    const [[members], [coverageRows]] = await Promise.all([
      bq.query({ query: membersQuery, params: { reconMonth } }),
      bq.query({ query: coverageQuery, params: { reconMonth } })
    ]);
    return NextResponse.json({ reconMonth, members, coverage: coverageRows[0] ?? null });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
