import { prisma } from "@/lib/prisma";
import type { Category } from "@/generated/prisma/enums";
import { summarizeWithGemini } from "./gemini";
import { summarizeWithGroq } from "./groq";
import type { SummaryResult } from "./types";

const REGENERATE_LIMIT = 5; // 3.7 재생성 rate limit(남용 방지)

async function runFallbackChain(text: string): Promise<SummaryResult> {
  const errors: string[] = [];

  if (process.env.GEMINI_API_KEY) {
    try {
      return await summarizeWithGemini(text);
    } catch (err) {
      errors.push(`Gemini: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (process.env.GROQ_API_KEY) {
    try {
      return await summarizeWithGroq(text);
    } catch (err) {
      errors.push(`Groq: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  if (errors.length === 0) {
    throw new Error("AI 요약 기능을 위한 API 키가 설정되지 않았습니다 (GEMINI_API_KEY 또는 GROQ_API_KEY 필요)");
  }

  throw new Error(`AI 요약 생성 실패: ${errors.join(" / ")}`);
}

// 3.7 트리거 시점: 등록/자동수집 직후 비동기 처리(등록자를 기다리게 하지 않음). after()로 응답 이후 실행.
export async function generateSummaryForPost(postId: string): Promise<void> {
  await prisma.summary.upsert({
    where: { postId },
    update: { status: "PENDING", errorMessage: null },
    create: { postId, status: "PENDING" },
  });

  const post = await prisma.post.findUnique({ where: { id: postId } });
  if (!post) return;

  try {
    const result = await runFallbackChain(post.contentText);
    await prisma.summary.update({
      where: { postId },
      data: {
        status: "READY",
        lines: result.lines,
        keywords: result.keywords,
        recommendFor: result.recommendFor,
        model: result.model,
        errorMessage: null,
      },
    });

    // 3.2: 자동 수집 글은 AI가 초기 분류를 제안(팀원이 이후 수정 가능). 팀원 등록 글의 선택은 덮어쓰지 않음.
    if (post.sourceType === "AUTO_COLLECTED" && result.categoryHint) {
      await prisma.post.update({
        where: { id: postId },
        data: { category: result.categoryHint as Category },
      });
    }
  } catch (err) {
    await prisma.summary.update({
      where: { postId },
      data: {
        status: "FAILED",
        errorMessage: err instanceof Error ? err.message : String(err),
      },
    });
  }
}

export async function regenerateSummary(postId: string): Promise<{ ok: boolean; error?: string }> {
  const existing = await prisma.summary.findUnique({ where: { postId } });
  if (existing && existing.regenerateCount >= REGENERATE_LIMIT) {
    return { ok: false, error: "재생성 횟수 제한을 초과했습니다. 잠시 후 다시 시도해주세요." };
  }

  await prisma.summary.upsert({
    where: { postId },
    update: { status: "PENDING", regenerateCount: { increment: 1 } },
    create: { postId, status: "PENDING", regenerateCount: 1 },
  });

  await generateSummaryForPost(postId);
  return { ok: true };
}
