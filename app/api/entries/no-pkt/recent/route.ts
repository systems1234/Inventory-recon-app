import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBigQuery, table, currentReconMonth } from "@/lib/bigquery";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT entry_number, location, gemstone, submitted_at
      FROM ${table("no_pkt_entries")}
      WHERE submitted_by = @email AND recon_month = @reconMonth
      ORDER BY submitted_at DESC
      LIMIT 25
    `,
    params: { email: session.user.email, reconMonth: currentReconMonth() }
  });

  return NextResponse.json({ entries: rows });
}
