import { extractArticleBody } from "@/lib/content/extract-body";
import { insertArticle } from "@/lib/db/articles";
import { listUserKeysFollowingCompany } from "@/lib/db/company-follows";
import { createNotification } from "@/lib/db/notifications";
import { articleSchema } from "@/lib/schemas/article";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = articleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청이에요" },
      { status: 400 },
    );
  }

  let createdBy: string | null = null;
  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    createdBy = user?.id ?? null;
  }

  const extracted = await extractArticleBody(parsed.data.url);

  const { data, error } = await insertArticle({
    url: parsed.data.url,
    title: parsed.data.title,
    company: parsed.data.company,
    category: parsed.data.category,
    tags: parsed.data.tags,
    thumbnail_url: parsed.data.thumbnailUrl ?? null,
    body_html: extracted?.html ?? null,
    body_byline: extracted?.byline ?? null,
    impressive_part: parsed.data.impressivePart,
    apply_idea: parsed.data.applyIdea,
    discussion_question: parsed.data.discussionQuestion,
    source_type: "manual",
    created_by: createdBy,
    note_author: createdBy,
  });

  if (error) {
    const status = error.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: error.message }, { status });
  }

  // local-store 백엔드는 파일 read-modify-write에 락이 없어 병렬 저장 시 내용이 깨진다 — 순차 처리한다.
  const followerKeys = await listUserKeysFollowingCompany(parsed.data.company);
  for (const key of followerKeys.filter((key) => key !== createdBy)) {
    await createNotification({
      userKey: key,
      type: "new_article",
      message: `좋아요한 기업 "${parsed.data.company}"에 새 글이 올라왔어요: ${parsed.data.title}`,
      articleId: data!.id,
    });
  }

  return NextResponse.json({ id: data!.id });
}
