import { PREVIEW_USER_KEY } from "@/lib/db/bookmarks";
import { addHighlight, listHighlightsByArticleAndUser } from "@/lib/db/highlights";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

const highlightSchema = z.object({
  quote: z.string().min(1).max(2000),
  note: z.string().max(2000).nullable().optional(),
  zone: z.enum(["ai_summary", "note", "body"]).default("body"),
});

async function resolveUserKey(): Promise<string | null> {
  if (!AUTH_REQUIRED) return PREVIEW_USER_KEY;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userKey = await resolveUserKey();
  if (!userKey) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const highlights = await listHighlightsByArticleAndUser(id, userKey);
  return NextResponse.json({ highlights });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userKey = await resolveUserKey();
  if (!userKey) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });

  const body = await request.json().catch(() => null);
  const parsed = highlightSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청이에요" },
      { status: 400 },
    );
  }

  const highlight = await addHighlight({
    articleId: id,
    userKey,
    quote: parsed.data.quote,
    note: parsed.data.note ?? null,
    zone: parsed.data.zone,
  });
  return NextResponse.json({ highlight });
}
