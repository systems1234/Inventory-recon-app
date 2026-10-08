import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { RECON_VIEWS, MAX_TEXT_LENGTH, fetchViewRows, findView, saveReview } from "@/lib/reconInvestigation";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  try {
    const results = await Promise.all(RECON_VIEWS.map((v) => fetchViewRows(v)));
    const views = RECON_VIEWS.map((v, i) => ({
      key: v.key,
      label: v.label,
      description: v.description,
      idColumn: v.idColumn,
      rows: results[i]
    }));
    return NextResponse.json({ views });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    view?: string;
    inventoryId?: string;
    comment?: string | null;
    action?: string | null;
  } | null;

  const view = body?.view ? findView(body.view) : undefined;
  const inventoryId = body?.inventoryId?.toString().trim();
  if (!view || !inventoryId) {
    return NextResponse.json({ error: "A valid view and inventoryId are required" }, { status: 400 });
  }

  const comment = body?.comment?.trim() || null;
  const action = body?.action?.trim() || null;
  if ((comment?.length ?? 0) > MAX_TEXT_LENGTH || (action?.length ?? 0) > MAX_TEXT_LENGTH) {
    return NextResponse.json({ error: `Max ${MAX_TEXT_LENGTH} characters per field` }, { status: 400 });
  }

  try {
    await saveReview(view, inventoryId, comment, action, session.user.email);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
