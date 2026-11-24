"use client";

import { ArticleCard } from "@/components/common/ArticleCard";
import { ROLE_META, type Recommendation, type Role } from "@/core/3-place/onboarding";

export function RecommendStep({
  role,
  interestLabels,
  recommendations,
  loading,
  onEditInterests,
  onPickArticle,
  onStart,
}: {
  role: Role;
  interestLabels: string[];
  recommendations: Recommendation[];
  loading: boolean;
  onEditInterests: () => void;
  /** 추천 글을 직접 눌렀을 때 — ArticleCard 는 그대로 쓰고, 클릭을 가로채 저장을 먼저 보낸다(TrackSection.tsx 와 같은 방식) */
  onPickArticle: (id: number) => void;
  onStart: () => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">새로운 관점을 발견할 준비가 되었어요.</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">내 업무에 필요한 사례부터 하나씩 살펴보세요.</p>

      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        <span className="rounded-md bg-bg px-2 py-0.5 text-xs font-semibold text-ink-2">{ROLE_META[role].label}</span>
        {interestLabels.map((label) => (
          <span key={label} className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">
            #{label}
          </span>
        ))}
        <button onClick={onEditInterests} className="ml-1 text-xs font-semibold text-ink-3 underline underline-offset-2 hover:text-ink">
          관심사 수정
        </button>
      </div>

      <div
        className="mt-5 flex flex-col gap-3"
        onClickCapture={(e) => {
          const link = (e.target as HTMLElement).closest("a[href^='/articles/']");
          if (!link) return;
          const id = Number(link.getAttribute("href")?.split("/").pop());
          if (Number.isFinite(id)) onPickArticle(id);
        }}
      >
        {loading ? (
          <div className="rounded-2xl border border-dashed border-line bg-surface p-8 text-center text-ink-3">추천 글을 고르고 있어요…</div>
        ) : (
          recommendations.map(({ article, reason }) => (
            <div key={article.id}>
              <ArticleCard a={article} />
              <p className="mt-1.5 px-1 text-xs text-ink-3">✦ {reason}</p>
            </div>
          ))
        )}
      </div>

      <button
        onClick={onStart}
        className="mt-10 flex h-14 w-full items-center justify-center rounded-full bg-brand text-[17px] font-bold text-white transition hover:brightness-110"
      >
        관점 아카이브 시작하기
      </button>
    </div>
  );
}
