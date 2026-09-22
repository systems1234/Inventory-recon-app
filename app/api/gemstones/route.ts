import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBigQuery, inventoryMasterTable } from "@/lib/bigquery";

// Gemstones are read-only here, sourced straight from the real inventory
// master (Gemstone2) instead of a separate list this app owns -- there's no
// "add gemstone" anymore, since it isn't this app's data to add to.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT DISTINCT Gemstone2 AS name
      FROM ${inventoryMasterTable()}
      WHERE Gemstone2 IS NOT NULL AND TRIM(Gemstone2) != ''
      ORDER BY name
    `
  });
  return NextResponse.json({ gemstones: rows.map((r: any) => r.name) });
}
