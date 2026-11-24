import Link from "next/link";
import { ArticleCard } from "@/components/common/ArticleCard";
import { HomeReadScope } from "@/components/common/ReadState";
import { TrackSection } from "./TrackSection";
import { ROLE_HOME_TITLE, type Recommendation, type Role } from "@/core/3-place/onboarding";

/** 홈 "나를 위한 관점" — 온보딩을 마친 로그인 사용자에게만 보인다. 스펙 11절: 기존 홈 구조는 그대로 두고 컴팩트하게 추가 */
export function PersonalizedSection({
  role,
  interestLabels,
  recommendations,
}: {
  role: Role;
  interestLabels: string[];
  recommendations: Recommendation[];
}) {
  if (recommendations.length === 0) return null;
  return (
    <TrackSection name="personalized" className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-bold tracking-tight">{ROLE_HOME_TITLE[role]}</h2>
        <Link href="/onboarding?restart=1" className="text-sm font-semibold text-ink-3 hover:text-brand">
          관심사 수정
        </Link>
      </div>
      {interestLabels.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {interestLabels.map((label) => (
            <span key={label} className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
              #{label}
            </span>
          ))}
        </div>
      )}
      <HomeReadScope>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {recommendations.map(({ article, reason }) => (
            <div key={article.id}>
              <ArticleCard a={article} />
              <p className="mt-1.5 px-1 text-xs text-ink-3">✦ {reason}</p>
            </div>
          ))}
        </div>
      </HomeReadScope>
    </TrackSection>
  );
}
