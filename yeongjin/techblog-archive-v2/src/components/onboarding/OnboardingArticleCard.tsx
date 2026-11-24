"use client";

import Link from "next/link";
import { cls, headlineOf } from "@/core/3-place/home";
import { BENEFICIARY_LABEL, EXPERIENCE_META, INTERNAL_TAG, isInternal } from "@/core/2-classify/taxonomy";
import { CompanyBadge, formatDate } from "@/components/common/CompanyBadge";
import { ReadBadge } from "@/components/common/ReadState";
import type { ArticleRow } from "@/core/shared/types";

/**
 * ArticleCard.tsx 와 같은 모양이지만, 온보딩처럼 클라이언트 컴포넌트 트리 안에서 쓰기 위한 것이다.
 * ArticleCard 는 companyLogo()(node:fs 로 public/logos 를 읽는 서버 전용 함수)를 안에서 직접 부르는데,
 * 그걸 클라이언트 컴포넌트가 import 하면 Turbopack 이 번들링 중 패닉한다("does not support external modules: node:fs").
 * 그래서 logo 는 서버에서 미리 구한 값을 prop 으로 받는다(CompanyBadge 가 이미 쓰는 것과 같은 패턴).
 */
export function OnboardingArticleCard({ a, logo }: { a: ArticleRow; logo: string | null }) {
  const l = a.learning;
  const c = cls(a);
  const headline = headlineOf(a);
  return (
    <Link
      href={`/articles/${a.id}`}
      data-card
      className="group block rounded-2xl border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:shadow-[0_6px_24px_rgba(0,0,0,0.06)] has-[[data-read=true]]:opacity-60 has-[[data-read=true]]:hover:opacity-100"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <CompanyBadge id={a.companyId} logo={logo} />
        <span className="flex items-center gap-1.5 text-xs text-ink-3">
          <ReadBadge id={a.id} />
          {formatDate(a.publishedAt)}
        </span>
      </div>
      <p className="text-[17px] font-bold leading-snug text-ink group-hover:text-brand">{headline}</p>
      {headline !== a.title && <p className="mt-1.5 line-clamp-1 text-sm text-ink-3">{a.title}</p>}
      {l && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {c && isInternal(c.beneficiary) && (
            <span
              className="inline-flex items-center gap-1 rounded-md bg-[#f1ecff] px-2 py-0.5 text-xs font-semibold text-[#5b3fd1]"
              title={`${BENEFICIARY_LABEL[c.beneficiary]}의 부담을 덜어준 사례예요`}
            >
              {INTERNAL_TAG}
            </span>
          )}
          {c?.experience && c.fit !== "NONE" && (
            <span className="rounded-md bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand">{EXPERIENCE_META[c.experience].short}</span>
          )}
          {c?.articleType && <span className="rounded-md bg-bg px-2 py-0.5 text-xs text-ink-2">{c.articleType}</span>}
          <span className="ml-auto text-xs text-ink-3">{l.readingTime}분</span>
        </div>
      )}
    </Link>
  );
}
