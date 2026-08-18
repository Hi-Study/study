import { PREVIEW_USER_KEY } from "@/lib/db/bookmarks";
import { addNoteToArticle, getArticleById } from "@/lib/db/articles";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

const noteSchema = z.object({
  impressivePart: z.string().min(20, "인상 깊은 부분은 20자 이상 적어주세요"),
  applyIdea: z.string().min(20, "접목하고 싶은 방법은 20자 이상 적어주세요"),
  discussionQuestion: z.string().min(20, "질문·토론하고 싶은 것은 20자 이상 적어주세요"),
});

// 자동 수집 글에 팀원이 나중에 독후감을 채우는 엔드포인트(PRD v0.2 4.11). 이미 노트가 있으면 덮어쓰지 않는다.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let authorKey = PREVIEW_USER_KEY;
  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
    authorKey = user.id;
  }

  const article = await getArticleById(id);
  if (!article) return NextResponse.json({ error: "글을 찾을 수 없어요" }, { status: 404 });
  if (article.impressive_part) {
    return NextResponse.json({ error: "이미 독후감이 작성된 글이에요" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const parsed = noteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청이에요" },
      { status: 400 },
    );
  }

  await addNoteToArticle(id, { ...parsed.data, authorKey });
  return NextResponse.json({ ok: true });
}
