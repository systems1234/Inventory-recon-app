import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBigQuery, table } from "@/lib/bigquery";
import { fetchInvestigationReport } from "@/lib/investigations";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const role = ((session.user as any).role ?? "member") as string;
  const id = req.nextUrl.searchParams.get("id");
  const week = req.nextUrl.searchParams.get("week");

  if (!id || !week) {
    return NextResponse.json({ error: "id and week are required" }, { status: 400 });
  }

  // Look the investigation up in the config table rather than trusting a
  // raw table name from the client — also enforces the admin_only gate.
  const bq = getBigQuery();
  const [rows] = await bq.query({
    query: `
      SELECT table_name, view_name, admin_only
      FROM ${table("investigations")}
      WHERE id = @id AND is_active = TRUE
      LIMIT 1
    `,
    params: { id }
  });

  if (rows.length === 0) {
    return NextResponse.json({ error: "Unknown investigation" }, { status: 404 });
  }

  const investigation = rows[0] as { table_name: string; view_name: string; admin_only: boolean };
  if (investigation.admin_only && role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const reportRows = await fetchInvestigationReport(investigation.table_name, investigation.view_name, week);
  return NextResponse.json({ rows: reportRows });
}
