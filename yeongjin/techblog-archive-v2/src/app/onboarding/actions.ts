"use server";

import { listArticles } from "@/core/shared/db";
import { recommendFor, ROLES, type Role } from "@/core/3-place/onboarding";
import type { ArticleRow } from "@/core/shared/types";

/** STEP 04 — 선택한 직군·관심사로 추천 글을 고른다. 전체 글 목록을 클라이언트로 내려보내지 않고 서버에서만 계산한다. */
export async function fetchRecommendations(
  role: string,
  interestIds: string[],
): Promise<{ article: ArticleRow; reason: string }[]> {
  if (!ROLES.includes(role as Role)) return [];
  const rows = await listArticles("included");
  return recommendFor(rows, role as Role, interestIds, 3);
}
