import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "./auth";
import { canChangeLocation } from "./roles";

/** Shared gate for the Edit Entries APIs: signed in + admin/senior/manager/tl. */
export async function requireEditAccess(): Promise<{ email: string; error?: undefined } | { error: NextResponse; email?: undefined }> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  const role = (session.user as any).role as string | undefined;
  if (!canChangeLocation(role)) {
    return { error: NextResponse.json({ error: "You don't have access to edit entries" }, { status: 403 }) };
  }
  return { email: session.user.email };
}
