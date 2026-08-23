import { getArticleById } from "@/lib/db/articles";
import { addComment, listCommentsByArticle } from "@/lib/db/comments";
import { PREVIEW_USER_KEY } from "@/lib/db/bookmarks";
import { createNotification } from "@/lib/db/notifications";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

const commentSchema = z.object({
  body: z.string().min(1, "댓글 내용을 입력해주세요"),
  parentId: z.string().nullable().optional(),
  authorName: z.string().min(1).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const comments = await listCommentsByArticle(id);
  return NextResponse.json({ comments });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "잘못된 요청이에요" },
      { status: 400 },
    );
  }

  let authorName = parsed.data.authorName || "익명";
  let userKey: string | null = PREVIEW_USER_KEY;
  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
    }
    authorName = user.email ?? authorName;
    userKey = user.id;
  }

  const parentId = parsed.data.parentId ?? null;
  const existingComments = await listCommentsByArticle(id);

  const comment = await addComment({
    articleId: id,
    parentId,
    userKey,
    authorName,
    body: parsed.data.body,
  });

  const snippet = parsed.data.body.slice(0, 40);
  if (parentId) {
    const parentComment = existingComments.find((c) => c.id === parentId);
    if (parentComment?.user_key && parentComment.user_key !== userKey) {
      await createNotification({
        userKey: parentComment.user_key,
        type: "reply",
        message: `내 댓글에 대댓글이 달렸어요: ${snippet}`,
        articleId: id,
      });
    }
  } else {
    const article = await getArticleById(id);
    if (article?.created_by && article.created_by !== userKey) {
      await createNotification({
        userKey: article.created_by,
        type: "note_comment",
        message: `내 독후감에 댓글이 달렸어요: ${snippet}`,
        articleId: id,
      });
    }
  }

  return NextResponse.json({ comment });
}
