"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export type ExperienceSlide = {
  slug: string;
  when: string;
  short: string;
  benefit: string;
  total: number;
  recent: number;
  example: { id: number; headline: string; company: string } | null;
};

/**
 * "우리 사용자에게 어떤 경험을 주고 싶나요?" — 경험 하나 = 카드 한 장
 * 우리 서비스에 비춰 보는 질문 → 전달할 경험 → 다른 서비스 사례로 이끄는 질문 → 대표 사례 → 새 소식 → 버튼(사례 수)
 */
export function ExperienceCarousel({ slides }: { slides: ExperienceSlide[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [page, setPage] = useState(0);
  const [pages, setPages] = useState(slides.length);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () => {
      const first = el.firstElementChild as HTMLElement | null;
      const per = first ? Math.max(1, Math.round(el.clientWidth / first.offsetWidth)) : 1;
      setPages(Math.max(1, slides.length - per + 1));
      setPage(first ? Math.round(el.scrollLeft / (first.offsetWidth + 12)) : 0);
    };
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [slides.length]);

  const go = (i: number) => {
    const el = track.current;
    const first = el?.firstElementChild as HTMLElement | null;
    if (el && first) el.scrollTo({ left: i * (first.offsetWidth + 12), behavior: "smooth" });
  };

  return (
    <div>
      <div
        ref={track}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 scrollbar-none md:mx-0 md:scroll-px-0 md:px-0"
      >
        {slides.map((s) => (
          <article
            key={s.slug}
            className="flex w-[calc(100%-8px)] shrink-0 snap-start flex-col rounded-[28px] bg-surface p-6 md:w-[calc(50%-6px)]"
          >
            {/* 우리 서비스에 비춰 보는 질문 → 전달할 경험 → 다른 서비스 사례로 이끄는 질문 */}
            <div>
              <p className="text-[15px] text-ink-3">{s.when}</p>
              <p className="mt-1.5 text-[24px] font-extrabold leading-[1.3] tracking-tight">{s.short}</p>
              <p className="mt-1 text-[18px] font-bold leading-snug text-brand">{s.benefit}</p>
            </div>

            {/* 대표 사례 */}
            {s.example && (
              <Link
                href={`/articles/${s.example.id}`}
                className="group mt-5 flex items-center gap-3 rounded-2xl bg-bg px-4 py-3.5"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-ink-3">
                    <b className="font-semibold text-brand">대표 사례</b> · {s.example.company}
                  </span>
                  <span className="mt-0.5 line-clamp-2 block text-[15px] font-semibold leading-snug">{s.example.headline}</span>
                </span>
                <span className="shrink-0 text-sm font-semibold text-ink-2 group-hover:text-brand">보기 ›</span>
              </Link>
            )}

            {/* 새 소식 배지 */}
            <p className="mt-auto flex items-center justify-center gap-2 pt-4 text-sm font-semibold">
              {s.recent > 0 && (
                <>
                  <span className="rounded-full bg-brand px-2 py-0.5 text-[11px] font-bold text-white">NEW</span>
                  최근 30일 새 사례 <span className="text-brand">{s.recent}건</span>
                </>
              )}
            </p>

            <Link
              href={`/experiences/${s.slug}`}
              className="mt-3 flex h-[52px] items-center justify-center rounded-2xl bg-brand-soft text-[16px] font-bold text-brand transition hover:brightness-95"
            >
              다른 서비스 사례 {s.total}건 보기
            </Link>
          </article>
        ))}
      </div>

      {pages > 1 && (
        <div className="mt-4 flex justify-center gap-1.5" aria-label="경험 카드 위치">
          {Array.from({ length: pages }).map((_, i) => (
            <button
              key={i}
              onClick={() => go(i)}
              aria-label={`${i + 1}번째 카드`}
              aria-current={i === page}
              className={`h-1.5 rounded-full transition-all ${i === page ? "w-5 bg-ink-2" : "w-1.5 bg-line"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
