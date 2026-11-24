import type { Metadata } from "next";
import { connection } from "next/server";
import { OnboardingFlow } from "@/components/onboarding/OnboardingFlow";
import { companyLogo } from "@/core/0-collect/logos";
import { requireUser, safeNext } from "@/core/shared/auth";
import { getUserPreferences, listArticles } from "@/core/shared/db";
import { experienceStats } from "@/core/3-place/home";
import { ROLES, type Role } from "@/core/3-place/onboarding";

export const metadata: Metadata = { title: "온보딩" };

/**
 * 구글 로그인 직후(또는 마이페이지 "온보딩 다시 경험하기")로 들어오는 4단계 "환영" 온보딩.
 * 2026-11-25 팀 논의: 로그인 전에 먼저 보여주는 안은 접고, 원래 스펙대로 로그인 완료 뒤에만 보여준다.
 */
export default async function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  await connection();
  const user = await requireUser("/onboarding");
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);

  const prefs = await getUserPreferences(user.id);
  const savedRole = prefs?.role && ROLES.includes(prefs.role as Role) ? (prefs.role as Role) : null;
  const rows = await listArticles("included");
  // STEP 03 데모 글 — 특정 글을 하드코딩하지 않고, 사례가 가장 많이 쌓인 경험 유형의 대표 글을 그대로 쓴다
  const stats = experienceStats(rows);
  const perspectiveArticle = stats.find((s) => s.example)?.example ?? rows[0] ?? null;
  const perspectiveLogo = perspectiveArticle ? companyLogo(perspectiveArticle.companyId) : null;

  return (
    <OnboardingFlow
      next={next}
      initialRole={savedRole}
      initialInterests={prefs?.interests ?? []}
      perspectiveArticle={perspectiveArticle}
      perspectiveLogo={perspectiveLogo}
    />
  );
}
