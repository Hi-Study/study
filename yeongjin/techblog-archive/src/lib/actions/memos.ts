"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type ActionState = { error?: string } | undefined;

const memoSchema = z.object({
  content: z.string().trim().min(1, "메모 내용을 입력해주세요").max(4000),
  noteType: z.enum(["OPINION", "NEED_REVIEW"]).optional(),
  isPublic: z.coerce.boolean().optional(),
});

// 3.10 개인 메모 — 기본 비공개, 메모별 "팀에 공개" 토글
export async function createMemoAction(
  postId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = memoSchema.safeParse({
    content: formData.get("content"),
    noteType: formData.get("noteType") || undefined,
    isPublic: formData.get("isPublic") === "on",
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  await prisma.memo.create({
    data: {
      postId,
      userId: user.id,
      content: parsed.data.content,
      noteType: parsed.data.noteType ?? null,
      isPublic: parsed.data.isPublic ?? false,
    },
  });

  revalidatePath(`/posts/${postId}`);
  revalidatePath("/my");
}

export async function toggleMemoVisibilityAction(memoId: string): Promise<ActionState> {
  const user = await requireUser();

  const memo = await prisma.memo.findUnique({ where: { id: memoId } });
  if (!memo || memo.userId !== user.id) {
    return { error: "본인 메모만 수정할 수 있습니다" };
  }

  await prisma.memo.update({ where: { id: memoId }, data: { isPublic: !memo.isPublic } });
  revalidatePath(`/posts/${memo.postId}`);
  revalidatePath("/my");
}

export async function deleteMemoAction(memoId: string): Promise<ActionState> {
  const user = await requireUser();

  const memo = await prisma.memo.findUnique({ where: { id: memoId } });
  if (!memo || memo.userId !== user.id) {
    return { error: "본인 메모만 삭제할 수 있습니다" };
  }

  await prisma.memo.delete({ where: { id: memoId } });
  revalidatePath(`/posts/${memo.postId}`);
  revalidatePath("/my");
}
