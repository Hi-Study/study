import { PREVIEW_USER_KEY } from "@/lib/db/bookmarks";
import { listNotificationsByUser, markAllNotificationsRead } from "@/lib/db/notifications";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

async function resolveUserKey(): Promise<string | null> {
  if (!AUTH_REQUIRED) return PREVIEW_USER_KEY;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET() {
  const userKey = await resolveUserKey();
  if (!userKey) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  const notifications = await listNotificationsByUser(userKey);
  return NextResponse.json({ notifications });
}

export async function POST() {
  const userKey = await resolveUserKey();
  if (!userKey) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
  await markAllNotificationsRead(userKey);
  return NextResponse.json({ ok: true });
}
