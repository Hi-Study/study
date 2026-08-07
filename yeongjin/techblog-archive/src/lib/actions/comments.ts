"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type ActionState = { error?: string } | undefined;

const commentSchema = z.object({
  content: z.string().trim().min(1, "댓글 내용을 입력해주세요").max(2000),
  parentId: z.string().trim().optional(),
});

// 3.3 팀원 간 댓글 — 대댓글 1단계까지 지원
export async function createCommentAction(
  postId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = commentSchema.safeParse({
    content: formData.get("content"),
    parentId: formData.get("parentId") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const { content, parentId } = parsed.data;

  if (parentId) {
    const parent = await prisma.comment.findUnique({ where: { id: parentId } });
    if (!parent || parent.postId !== postId) {
      return { error: "존재하지 않는 댓글입니다" };
    }
    if (parent.parentId) {
      return { error: "답글에는 다시 답글을 달 수 없습니다 (최대 1단계)" };
    }
  }

  await prisma.comment.create({
    data: { postId, authorId: user.id, content, parentId: parentId ?? null },
  });

  revalidatePath(`/posts/${postId}`);
}

export async function deleteCommentAction(postId: string, commentId: string): Promise<ActionState> {
  const user = await requireUser();

  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment || comment.postId !== postId) {
    return { error: "존재하지 않는 댓글입니다" };
  }
  if (comment.authorId !== user.id) {
    return { error: "본인 댓글만 삭제할 수 있습니다" };
  }

  await prisma.comment.update({ where: { id: commentId }, data: { deletedAt: new Date() } });
  revalidatePath(`/posts/${postId}`);
}
