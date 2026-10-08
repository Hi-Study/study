"use client";

import Link from "next/link";
import { useState } from "react";
import { ReadBadge, useUnreadFirst } from "@/components/common/ReadState";

export type TechItem = {
  slug: string;
  label: string;
  total: number;
  articles: { id: number; headline: string; company: string; date: string; logo: string | null; color: string }[];
};

/** "요즘 자주 나오는 기술" — 키워드를 탭처럼 고르면 그 기술의 관련 글이 아래에 묶여 나온다 */
export function TechExplorer({ items }: { items: TechItem[] }) {
  const [sel, setSel] = useState(0);
  const t = items[sel];
  // "내가 읽은 글" OFF 면 읽은 글을 빼고 안 읽은 최신 글로 4개를 채운다
  const articles = useUnreadFirst(t?.articles ?? [], 4);
  if (!t) return null;

  return (
    <div>
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 scrollbar-none md:flex-wrap" role="tablist" aria-label="기술 키워드">
        {items.map((it, i) => (
          <button
            key={it.slug}
            role="tab"
            aria-selected={i === sel}
            aria-controls="tech-panel"
            onClick={() => setSel(i)}
            className={`shrink-0 rounded-full px-4 py-2 text-[15px] font-semibold transition ${
              i === sel ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink"
            }`}
          >
            # {it.label}
            <span className={`ml-1.5 text-xs font-normal ${i === sel ? "text-white/60" : "text-ink-3"}`}>{it.total}</span>
          </button>
        ))}
      </div>

      <div id="tech-panel" role="tabpanel" className="mt-4 rounded-3xl bg-surface px-6 py-2 md:px-8">
        {articles.length === 0 && (
          <p className="py-6 text-center text-sm text-ink-3">이 기술의 최근 글을 모두 읽었어요.</p>
        )}
        <ul className="divide-y divide-line">
          {articles.map((a) => (
            <li key={a.id}>
              <Link href={`/articles/${a.id}`} className="group flex items-center gap-4 py-4">
                {/* 썸네일 자리 — 회사 로고 */}
                <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-line">
                  {a.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.logo} alt={`${a.company} 로고`} className="size-8 object-contain" />
                  ) : (
                    <span className="text-lg font-extrabold" style={{ color: a.color }}>
                      {a.company.slice(0, 1)}
                    </span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs text-ink-3">
                    {a.company} · {a.date}
                    <ReadBadge id={a.id} />
                  </span>
                  <span className="mt-1 block font-semibold leading-snug group-hover:text-brand">{a.headline}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href={`/tech/${t.slug}`} className="block border-t border-line py-4 text-sm font-semibold text-brand">
          # {t.label} 글 {t.total}건 모두 보기 →
        </Link>
      </div>
    </div>
  );
}
