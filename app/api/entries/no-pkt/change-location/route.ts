import { NextRequest, NextResponse } from "next/server";
import { v4 as uuid } from "uuid";
import { requireEditAccess } from "@/lib/editAccess";
import { changeLocation, recentChanges, LocationChangeError } from "@/lib/locationChange";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await requireEditAccess();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ changes: await recentChanges() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireEditAccess();
  if (auth.error) return auth.error;

  const body = (await req.json().catch(() => null)) as { entry_number?: string; location?: string } | null;
  const entryNumber = (body?.entry_number ?? "").replace(/\D/g, "");
  const location = body?.location?.trim();
  if (!entryNumber || !location) {
    return NextResponse.json({ error: "Inventory ID and location are required" }, { status: 400 });
  }

  try {
    const { oldLocation } = await changeLocation(entryNumber, location, auth.email, uuid());
    return NextResponse.json({ ok: true, entry_number: entryNumber, old_location: oldLocation, new_location: location });
  } catch (err) {
    if (err instanceof LocationChangeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
