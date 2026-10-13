import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { requireEditAccess } from "@/lib/editAccess";
import { changeInventoryId, recentInventoryChanges } from "@/lib/inventoryChange";
import { LocationChangeError } from "@/lib/locationChange";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireEditAccess();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ changes: await recentInventoryChanges() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireEditAccess();
  if (auth.error) return auth.error;

  const body = (await req.json().catch(() => null)) as { current_id?: string; new_id?: string } | null;
  const currentId = (body?.current_id ?? "").replace(/\D/g, "");
  const newId = (body?.new_id ?? "").replace(/\D/g, "");
  if (!currentId || !newId) {
    return NextResponse.json({ error: "Current and new Inventory ID are required" }, { status: 400 });
  }

  try {
    const { source } = await changeInventoryId(currentId, newId, auth.email, uuid());
    return NextResponse.json({ ok: true, current_id: currentId, new_id: newId, source });
  } catch (err) {
    if (err instanceof LocationChangeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
