import { PREVIEW_USER_KEY } from "@/lib/db/bookmarks";
import { deleteNotification, setNotificationRead } from "@/lib/db/notifications";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

async function resolveUserKey(): Promise<string | null> {
  if (!AUTH_REQUIRED) return PREVIEW_USER_KEY;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

const patchSchema = z.object({ read: z.boolean() });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userKey = await resolveUserKey();
  if (!userKey) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "잘못된 요청이에요" }, { status: 400 });

  await setNotificationRead(id, userKey, parsed.data.read);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userKey = await resolveUserKey();
  if (!userKey) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  await deleteNotification(id, userKey);
  return NextResponse.json({ ok: true });
}
