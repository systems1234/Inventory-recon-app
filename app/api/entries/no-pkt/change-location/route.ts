import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { v4 as uuid } from "uuid";
import { authOptions } from "@/lib/auth";
import { canChangeLocation } from "@/lib/roles";
import { changeLocation, recentChanges, LocationChangeError } from "@/lib/locationChange";

export const dynamic = "force-dynamic";

async function authorize() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const role = (session.user as any).role as string | undefined;
  if (!canChangeLocation(role)) {
    return { error: NextResponse.json({ error: "You don't have access to change locations" }, { status: 403 }) };
  }
  return { email: session.user.email };
}

export async function GET() {
  const auth = await authorize();
  if (auth.error) return auth.error;
  try {
    return NextResponse.json({ changes: await recentChanges() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await authorize();
  if (auth.error) return auth.error;

  const body = (await req.json().catch(() => null)) as { entry_number?: string; location?: string } | null;
  const entryNumber = (body?.entry_number ?? "").replace(/\D/g, "");
  const location = body?.location?.trim();
  if (!entryNumber || !location) {
    return NextResponse.json({ error: "Inventory ID and location are required" }, { status: 400 });
  }

  try {
    const { oldLocation } = await changeLocation(entryNumber, location, auth.email!, uuid());
    return NextResponse.json({ ok: true, entry_number: entryNumber, old_location: oldLocation, new_location: location });
  } catch (err) {
    if (err instanceof LocationChangeError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
