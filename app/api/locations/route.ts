import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getBigQuery, table } from "@/lib/bigquery";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const bq = getBigQuery();

  // Plain mode (default): name-only list for the entry forms' dropdowns.
  // Full mode: everything, for the /locations management view's table.
  if (req.nextUrl.searchParams.get("full") === "1") {
    const [rows] = await bq.query({
      query: `
        SELECT name, is_active, added_by, added_at
        FROM ${table("locations")}
        ORDER BY name
      `
    });
    return NextResponse.json({ locations: rows });
  }

  const [rows] = await bq.query({
    query: `
      SELECT name FROM ${table("locations")}
      WHERE is_active = TRUE
      ORDER BY name
    `
  });
  return NextResponse.json({ locations: rows.map((r: any) => r.name) });
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const name = (body?.name as string | undefined)?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }

  const bq = getBigQuery();

  const [existing] = await bq.query({
    query: `SELECT name FROM ${table("locations")} WHERE LOWER(name) = LOWER(@name) LIMIT 1`,
    params: { name }
  });
  if (existing.length > 0) {
    return NextResponse.json({ error: `"${name}" already exists` }, { status: 409 });
  }

  await bq.query({
    query: `
      INSERT INTO ${table("locations")} (name, is_active, added_by, added_at)
      VALUES (@name, TRUE, @addedBy, CURRENT_TIMESTAMP())
    `,
    params: { name, addedBy: session.user.email }
  });

  return NextResponse.json({ ok: true, name });
}
