import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBigQuery, inventoryMasterTable, table } from "@/lib/bigquery";

// Gemstones are read-only, sourced from the real inventory master
// (Gemstone2) rather than a list this app owns. Locations still live in
// their own table -- see sql/create_gemstone_location_tables.sql -- managed
// from the dedicated /locations view. Response shape kept the same so every
// existing caller of /api/criteria works unchanged.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bq = getBigQuery();

  const [gemstoneRows] = await bq.query({
    query: `
      SELECT DISTINCT Gemstone2 AS name
      FROM ${inventoryMasterTable()}
      WHERE Gemstone2 IS NOT NULL AND TRIM(Gemstone2) != ''
      ORDER BY name
    `
  });

  const [locationRows] = await bq.query({
    query: `SELECT name FROM ${table("locations")} WHERE is_active = TRUE ORDER BY name`
  });

  return NextResponse.json({
    gemstones: gemstoneRows.map((r: any) => r.name),
    locations: locationRows.map((r: any) => r.name)
  });
}
