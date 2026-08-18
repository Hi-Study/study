import { PREVIEW_USER_KEY } from "@/lib/db/bookmarks";
import { listDraftsByUser, saveDraft } from "@/lib/db/drafts";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

const draftDataSchema = z.object({
  url: z.string(),
  category: z.string(),
  tagsInput: z.string(),
  preview: z
    .object({ title: z.string(), company: z.string(), thumbnailUrl: z.string().nullable() })
    .nullable(),
  notes: z.object({
    impressivePart: z.string(),
    applyIdea: z.string(),
    discussionQuestion: z.string(),
  }),
});

const bodySchema = z.object({ id: z.string().nullable().optional(), data: draftDataSchema });

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
  const drafts = await listDraftsByUser(userKey);
  return NextResponse.json({ drafts });
}

export async function POST(request: Request) {
  const userKey = await resolveUserKey();
  if (!userKey) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청이에요" },
      { status: 400 },
    );
  }

  const draft = await saveDraft({ id: parsed.data.id ?? null, userKey, data: parsed.data.data });
  return NextResponse.json({ draft });
}
