import type { Metadata } from "next";
import { connection } from "next/server";
import { MyLists } from "@/components/common/MyLists";
import { OpenOnboardingButton } from "@/components/onboarding/OpenOnboardingButton";
import { companyLogo } from "@/core/0-collect/logos";
import { requireUser } from "@/core/shared/auth";
import { getUserPreferences, listArticles } from "@/core/shared/db";
import { headlineOf } from "@/core/3-place/home";
import { ROLE_INTERESTS, ROLE_META, ROLES, type Role } from "@/core/3-place/onboarding";

export const metadata: Metadata = { title: "마이" };

export default async function MyPage() {
  await connection();
  const user = await requireUser("/my");
  const prefs = await getUserPreferences(user.id);
  const role = prefs && ROLES.includes(prefs.role as Role) ? (prefs.role as Role) : null;
  const interestLabels = role ? ROLE_INTERESTS[role].filter((i) => prefs!.interests.includes(i.id)).map((i) => i.label) : [];
  // 북마크·읽은 글 id 는 브라우저가 계정에서 받아 오니(AccountSync), 목록 렌더에 필요한 최소 정보만 넘긴다
  const items = (await listArticles("included")).map((a) => ({
    id: a.id,
    companyId: a.companyId,
    logo: companyLogo(a.companyId),
    title: a.title,
    hook: headlineOf(a),
    publishedAt: a.publishedAt,
  }));
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">마이</h1>
      <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3">
        <p className="min-w-0 truncate text-sm text-ink-2">
          <b className="text-ink">{user.email}</b> 로 로그인했어요
        </p>
        {/* 로그아웃은 POST 로만 — 링크 미리 불러오기로 로그아웃되지 않게 */}
        <form action="/auth/logout" method="post" className="shrink-0">
          <button className="text-sm font-semibold text-ink-3 transition hover:text-ink">로그아웃</button>
        </form>
      </div>

      <div className="mt-4 rounded-xl border border-line bg-surface px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-bold text-ink">나의 관심 관점</p>
          <OpenOnboardingButton label={role ? "수정" : "설정하기"} />
        </div>
        {role ? (
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-bg px-2 py-0.5 text-xs font-semibold text-ink-2">{ROLE_META[role].label}</span>
            {interestLabels.map((label) => (
              <span key={label} className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
                #{label}
              </span>
            ))}
          </div>
        ) : (
          <p className="mt-1.5 text-sm text-ink-3">아직 설정하지 않았어요. 직군을 고르면 맞춤 사례를 보여드려요.</p>
        )}
      </div>

      <MyLists items={items} />
    </div>
  );
}
