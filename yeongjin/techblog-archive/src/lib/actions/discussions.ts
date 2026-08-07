"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";

export type ActionState = { error?: string } | undefined;

const discussionSchema = z.object({
  topic: z.string().trim().min(1, "토론 주제를 입력해주세요").max(200),
  reason: z.string().trim().min(1, "신청 이유를 입력해주세요").max(2000),
});

// 3.11 토론 신청 — 신청 완료 시 팀 전체 브로드캐스트 알림
export async function createDiscussionAction(
  postId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = discussionSchema.safeParse({
    topic: formData.get("topic"),
    reason: formData.get("reason"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  await prisma.discussion.create({
    data: { postId, requesterId: user.id, ...parsed.data },
  });

  const post = await prisma.post.findUnique({ where: { id: postId }, select: { title: true } });
  const others = await prisma.user.findMany({ where: { id: { not: user.id } }, select: { id: true } });

  if (others.length > 0) {
    await prisma.notification.createMany({
      data: others.map((u) => ({
        userId: u.id,
        message: `${user.name}님이 "${post?.title ?? "글"}"에 토론을 신청했습니다: ${parsed.data.topic}`,
        link: `/posts/${postId}?tab=discussion`,
      })),
    });
  }

  revalidatePath(`/posts/${postId}`);
}

// 참여 인원 제한 없음, 참여 시 모집 중 -> 진행 중 자동 전환(3.11)
export async function joinDiscussionAction(discussionId: string): Promise<ActionState> {
  const user = await requireUser();

  const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
  if (!discussion || discussion.status === "CLOSED") {
    return { error: "참여할 수 없는 토론입니다" };
  }

  await prisma.discussionParticipant.upsert({
    where: { discussionId_userId: { discussionId, userId: user.id } },
    update: { isActive: true, leftAt: null },
    create: { discussionId, userId: user.id },
  });

  if (discussion.status === "OPEN") {
    await prisma.discussion.update({ where: { id: discussionId }, data: { status: "IN_PROGRESS" } });
  }

  revalidatePath(`/posts/${discussion.postId}`);
  revalidatePath(`/discussions/${discussionId}`);
}

// 참여 후 언제든 중도 이탈 허용(3.11)
export async function leaveDiscussionAction(discussionId: string): Promise<ActionState> {
  const user = await requireUser();

  const participant = await prisma.discussionParticipant.findUnique({
    where: { discussionId_userId: { discussionId, userId: user.id } },
  });
  if (!participant) return { error: "참여 중인 토론이 아닙니다" };

  await prisma.discussionParticipant.update({
    where: { discussionId_userId: { discussionId, userId: user.id } },
    data: { isActive: false, leftAt: new Date() },
  });

  const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
  revalidatePath(`/posts/${discussion?.postId}`);
  revalidatePath(`/discussions/${discussionId}`);
}

// 개설자만 종료 처리 가능(3.11)
export async function closeDiscussionAction(discussionId: string): Promise<ActionState> {
  const user = await requireUser();

  const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
  if (!discussion) return { error: "존재하지 않는 토론입니다" };
  if (discussion.requesterId !== user.id) {
    return { error: "토론을 개설한 신청자만 종료할 수 있습니다" };
  }

  await prisma.discussion.update({
    where: { id: discussionId },
    data: { status: "CLOSED", closedAt: new Date() },
  });

  revalidatePath(`/posts/${discussion.postId}`);
  revalidatePath(`/discussions/${discussionId}`);
}

const messageSchema = z.object({
  content: z.string().trim().min(1, "메시지를 입력해주세요").max(4000),
});

export async function postDiscussionMessageAction(
  discussionId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const discussion = await prisma.discussion.findUnique({ where: { id: discussionId } });
  if (!discussion || discussion.status === "CLOSED") {
    return { error: "종료된 토론에는 메시지를 남길 수 없습니다" };
  }

  const parsed = messageSchema.safeParse({ content: formData.get("content") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const isParticipant = await prisma.discussionParticipant.findUnique({
    where: { discussionId_userId: { discussionId, userId: user.id } },
  });
  if (!isParticipant && discussion.requesterId !== user.id) {
    return { error: "토론에 참여한 팀원만 메시지를 남길 수 있습니다" };
  }

  await prisma.discussionMessage.create({
    data: { discussionId, authorId: user.id, content: parsed.data.content },
  });

  revalidatePath(`/discussions/${discussionId}`);
}

export async function markNotificationsReadAction(): Promise<void> {
  const user = await requireUser();
  await prisma.notification.updateMany({
    where: { userId: user.id, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}
