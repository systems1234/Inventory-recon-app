import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBigQuery, table } from "@/lib/bigquery";

// Gemstones are read-only here, sourced from this app's own gemstones table
// (inventory_recon.gemstones) -- there's no "add gemstone" from the entry
// forms anymore; that table is managed independently of this endpoint.
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT name FROM ${table("gemstones")}
      WHERE is_active = TRUE
      ORDER BY name
    `
  });
  return NextResponse.json({ gemstones: rows.map((r: any) => r.name) });
}
