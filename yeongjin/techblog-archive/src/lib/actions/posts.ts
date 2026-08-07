"use server";

import { z } from "zod";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/session";
import { extractMetadata } from "@/lib/og";
import { extractFullContent } from "@/lib/readability";
import { generateSummaryForPost, regenerateSummary as regenerateSummaryPipeline } from "@/lib/ai/summarize";
import type { Category } from "@/generated/prisma/enums";

export type ActionState = { error?: string } | undefined;

const CATEGORY_VALUES = ["BACKEND", "FRONTEND", "DATA_AI", "INFRA_DEVOPS", "CULTURE_PROCESS", "ETC"] as const;

const registerSchema = z.object({
  category: z.enum(CATEGORY_VALUES),
  url: z.string().trim().url("올바른 URL을 입력해주세요"),
  insight: z.string().trim().optional(),
  technical: z.string().trim().optional(),
  applied: z.string().trim().optional(),
});

async function matchCompanyId(url: string, siteName: string | null): Promise<string | null> {
  const companies = await prisma.company.findMany();
  let hostname = "";
  try {
    hostname = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    // noop
  }

  for (const company of companies) {
    const companyHostname = new URL(company.blogUrl).hostname.replace(/^www\./, "");
    if (hostname && (hostname === companyHostname || hostname.endsWith(`.${companyHostname}`))) {
      return company.id;
    }
  }

  if (siteName) {
    const match = companies.find(
      (c) => siteName.includes(c.name) || c.name.includes(siteName)
    );
    if (match) return match.id;
  }

  return null;
}

// 3.4 글 등록 — 카테고리·URL만 필수, 등록 노트는 권장이지만 건너뛰기 가능
export async function registerPostAction(_prevState: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser();

  const parsed = registerSchema.safeParse({
    category: formData.get("category"),
    url: formData.get("url"),
    insight: formData.get("insight") || undefined,
    technical: formData.get("technical") || undefined,
    applied: formData.get("applied") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  const { category, url, insight, technical, applied } = parsed.data;
  const hasNote = Boolean(insight || technical || applied);

  const existing = await prisma.post.findUnique({ where: { originalUrl: url } });
  if (existing) {
    if (hasNote) {
      if (!insight || insight.length < 1) {
        return { error: "등록자 노트를 작성하려면 핵심 인사이트를 입력해주세요" };
      }
      await prisma.registrantNote.create({
        data: { postId: existing.id, authorId: user.id, insight, technical, applied },
      });
      revalidatePath(`/posts/${existing.id}`);
    }
    redirect(`/posts/${existing.id}`);
  }

  if (hasNote && (!insight || insight.length < 1)) {
    return { error: "등록자 노트를 작성하려면 핵심 인사이트를 입력해주세요" };
  }

  let content;
  try {
    content = await extractFullContent(url);
  } catch (err) {
    return { error: err instanceof Error ? err.message : "본문을 가져오지 못했습니다" };
  }

  const metadata = await extractMetadata(url).catch(() => null);
  const companyId = await matchCompanyId(url, metadata?.siteName ?? null);

  const post = await prisma.post.create({
    data: {
      title: metadata?.title && metadata.title !== url ? metadata.title : content.contentText.slice(0, 80),
      originalUrl: url,
      companyId,
      authorName: metadata?.authorName ?? null,
      publishedAt: metadata?.publishedAt ?? null,
      thumbnailUrl: metadata?.thumbnailUrl ?? null,
      contentHtml: content.contentHtml,
      contentText: content.contentText,
      contentHash: content.contentHash,
      category: category as Category,
      sourceType: "MEMBER_REGISTERED",
      registeredById: user.id,
    },
  });

  if (hasNote && insight) {
    await prisma.registrantNote.create({
      data: { postId: post.id, authorId: user.id, insight, technical, applied },
    });
  }

  // 등록자를 기다리게 하지 않는 비동기 AI 요약(3.7)
  after(() => generateSummaryForPost(post.id));

  revalidatePath("/explore");
  redirect(`/posts/${post.id}`);
}

const noteSchema = z.object({
  insight: z.string().trim().min(1, "핵심 인사이트를 입력해주세요"),
  technical: z.string().trim().optional(),
  applied: z.string().trim().optional(),
});

// 자동 수집 글 · 노트를 건너뛴 글에 팀원 누구나 나중에 노트 추가 가능(3.1, 3.4)
export async function addRegistrantNoteAction(
  postId: string,
  _prevState: ActionState,
  formData: FormData
): Promise<ActionState> {
  const user = await requireUser();

  const parsed = noteSchema.safeParse({
    insight: formData.get("insight"),
    technical: formData.get("technical") || undefined,
    applied: formData.get("applied") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "입력값을 확인해주세요" };
  }

  await prisma.registrantNote.create({
    data: { postId, authorId: user.id, ...parsed.data },
  });

  revalidatePath(`/posts/${postId}`);
}

// 3.4 삭제 — 소프트 삭제. 등록자 본인만 가능(자동 수집 글은 등록자가 없어 팀원 삭제 불가, 관리자 기능은 MVP 이후)
export async function softDeletePostAction(postId: string): Promise<ActionState> {
  const user = await requireUser();

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post || post.deletedAt) {
    return { error: "존재하지 않는 글입니다" };
  }

  if (post.sourceType === "AUTO_COLLECTED") {
    return { error: "자동 수집 글은 팀원이 삭제할 수 없습니다" };
  }

  if (post.registeredById !== user.id) {
    return { error: "등록자 본인만 삭제할 수 있습니다" };
  }

  await prisma.post.update({
    where: { id: postId },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  revalidatePath("/explore");
  redirect("/explore");
}

export async function regenerateSummaryAction(postId: string): Promise<ActionState> {
  await requireUser();
  const result = await regenerateSummaryPipeline(postId);
  revalidatePath(`/posts/${postId}`);
  if (!result.ok) return { error: result.error };
}

// 3.9 읽기 상태 — 글 상세 진입 시 자동으로 읽는 중으로 전환, 조회수/이번 주 인기 글 계산용 로그 남김
export async function recordPostViewAction(postId: string): Promise<void> {
  const user = await requireUser();

  await prisma.$transaction([
    prisma.post.update({ where: { id: postId }, data: { viewCount: { increment: 1 } } }),
    prisma.postView.create({ data: { postId, userId: user.id } }),
    // 진입 순간 자동으로 "읽는 중"으로 전환(이미 읽는 중/다 읽음이면 상태 유지, 열람 시각만 갱신)
    prisma.readingState.upsert({
      where: { userId_postId: { userId: user.id, postId } },
      update: { lastViewedAt: new Date() },
      create: { userId: user.id, postId, status: "READING" },
    }),
  ]);
}

// 스크롤 90% 도달 자동 전환 또는 "읽음으로 표시" 수동 전환(3.9)
export async function markPostReadAction(postId: string): Promise<void> {
  const user = await requireUser();

  await prisma.readingState.upsert({
    where: { userId_postId: { userId: user.id, postId } },
    update: { status: "DONE", lastViewedAt: new Date() },
    create: { userId: user.id, postId, status: "DONE" },
  });

  revalidatePath(`/posts/${postId}`);
  revalidatePath("/my");
}

export async function toggleBookmarkAction(postId: string): Promise<{ bookmarked: boolean }> {
  const user = await requireUser();

  const existing = await prisma.bookmark.findUnique({
    where: { userId_postId: { userId: user.id, postId } },
  });

  if (existing) {
    await prisma.bookmark.delete({ where: { id: existing.id } });
    revalidatePath(`/posts/${postId}`);
    revalidatePath("/my");
    return { bookmarked: false };
  }

  await prisma.bookmark.create({ data: { userId: user.id, postId } });
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/my");
  return { bookmarked: true };
}
