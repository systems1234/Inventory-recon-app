import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBigQuery, table } from "@/lib/bigquery";

// Gemstone/location used to be read out of `criteria` (a 5-column table used
// for other things too). They now live in their own gemstones/locations
// tables -- see sql/create_gemstone_location_tables.sql -- so users can add
// to them from the entry forms. Response shape kept the same so every
// existing caller of /api/criteria works unchanged.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bq = getBigQuery();

  const [gemstoneRows] = await bq.query({
    query: `SELECT name FROM ${table("gemstones")} WHERE is_active = TRUE ORDER BY name`
  });

  const [locationRows] = await bq.query({
    query: `SELECT name FROM ${table("locations")} WHERE is_active = TRUE ORDER BY name`
  });

  return NextResponse.json({
    gemstones: gemstoneRows.map((r: any) => r.name),
    locations: locationRows.map((r: any) => r.name)
  });
}
