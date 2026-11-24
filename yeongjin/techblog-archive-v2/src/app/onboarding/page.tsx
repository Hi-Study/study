import type { Metadata } from "next";
import { connection } from "next/server";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { companyLogo } from "@/core/0-collect/logos";
import { currentUser, safeNext } from "@/core/shared/auth";
import { getUserPreferences, listArticles } from "@/core/shared/db";
import { experienceStats } from "@/core/3-place/home";
import { ROLES, type Role } from "@/core/3-place/onboarding";

export const metadata: Metadata = { title: "온보딩" };

/**
 * STEP 01~03(직군·관심사·관점 체험)은 로그인 없이 누구나 볼 수 있다 — "로그인하면 이런 걸 얻을 수 있다"는
 * 경험을 먼저 보여준 뒤 STEP 04(맞춤 추천)로 넘어갈 때 구글 로그인을 요청한다(OnboardingFlow 의 LoginGate).
 * 기준 문서: 2026-11-24 스펙 + 2026-11-25 로그인 시점 변경 논의.
 */
export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  await connection();
  const user = await currentUser();
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);

  const prefs = user ? await getUserPreferences(user.id) : null;
  const savedRole = prefs?.role && ROLES.includes(prefs.role as Role) ? (prefs.role as Role) : null;
  const rows = await listArticles("included");
  // STEP 03 데모 글 — 특정 글을 하드코딩하지 않고, 사례가 가장 많이 쌓인 경험 유형의 대표 글을 그대로 쓴다
  const stats = experienceStats(rows);
  const perspectiveArticle = stats.find((s) => s.example)?.example ?? rows[0] ?? null;
  const perspectiveLogo = perspectiveArticle ? companyLogo(perspectiveArticle.companyId) : null;

  return (
    <OnboardingFlow
      next={next}
      isLoggedIn={!!user}
      initialRole={savedRole}
      initialInterests={prefs?.interests ?? []}
      perspectiveArticle={perspectiveArticle}
      perspectiveLogo={perspectiveLogo}
    />
  );
}
