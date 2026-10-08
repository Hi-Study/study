"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ReadBadge, useUnreadFirst } from "@/components/common/ReadState";

export type HeroSlide = {
  id: number;
  headline: string;
  title: string;
  company: string;
  color: string;
  logo: string | null;
  thumbnail: string | null;
  experience: string | null;
  internal: boolean;
  date: string;
};

const MAX_SLIDES = 4;
const INTERVAL_MS = 4500;

/** 썸네일이 없으면 회사 로고와 대표 색을 블러 처리해 배경으로 깐다 */
function Visual({ s }: { s: HeroSlide }) {
  const color = s.color === "#111111" ? "#2b2f36" : s.color;
  if (s.thumbnail)
    return (
      <div className="relative h-48 overflow-hidden rounded-3xl bg-bg md:h-60">
        {/* 외부 블로그 이미지라 next/image 최적화 대상 도메인을 정할 수 없어 img 를 쓴다 */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={s.thumbnail} alt="" className="size-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
        <span className="absolute bottom-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs font-bold text-white backdrop-blur">
          {s.company}
        </span>
      </div>
    );

  return (
    <div className="relative grid h-48 place-items-center overflow-hidden rounded-3xl md:h-60" style={{ background: `${color}1f` }}>
      {/* 배경: 대표 색 덩어리 + 크게 키운 로고를 블러 */}
      <div className="absolute -left-10 -top-10 size-56 rounded-full opacity-70 blur-3xl" style={{ background: color }} />
      <div className="absolute -bottom-12 -right-6 size-48 rounded-full opacity-50 blur-3xl" style={{ background: color }} />
      {s.logo && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={s.logo} alt="" aria-hidden className="absolute size-[340px] object-contain opacity-35 blur-2xl" />
      )}
      {/* 전경: 선명한 로고 */}
      <div className="relative flex flex-col items-center gap-3">
        <div className="grid size-20 place-items-center rounded-[22px] bg-white shadow-[0_8px_24px_rgba(0,0,0,0.12)] md:size-24">
          {s.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.logo} alt={`${s.company} 로고`} className="size-12 object-contain md:size-14" />
          ) : (
            <span className="text-2xl font-extrabold" style={{ color }}>
              {s.company.slice(0, 1)}
            </span>
          )}
        </div>
        <span className="rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-ink backdrop-blur">{s.company}</span>
      </div>
    </div>
  );
}

/** 홈 맨 위 — 새로 들어온 글을 최대 4장, 자동으로 넘겨 보는 카드 */
export function NewArticlesHero({ slides: all }: { slides: HeroSlide[] }) {
  // "내가 읽은 글" OFF 면 읽은 글을 빼고 안 읽은 최신 글로 4장을 채운다
  const slides = useUnreadFirst(all, MAX_SLIDES);
  const slideKey = slides.map((s) => s.id).join(",");
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const go = useCallback((i: number) => {
    const el = track.current;
    if (!el) return;
    // 스크롤 애니메이션이 끝나기를 기다리지 않고 위치를 먼저 바꾼다 — 다음 자동 롤링 타이머가 바로 이어진다
    setIndex(i);
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / el.clientWidth));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  // 카드 묶음이 바뀌면(읽은 글 ON/OFF) 첫 장으로
  useEffect(() => {
    track.current?.scrollTo({ left: 0 });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIndex(0);
  }, [slideKey]);

  // 자동 롤링 — 마지막 다음은 처음으로. 손을 대고 있거나 동작 줄이기 설정이면 멈춘다
  useEffect(() => {
    if (paused || slides.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => go((index + 1) % slides.length), INTERVAL_MS);
    return () => window.clearTimeout(t);
  }, [index, paused, slides.length, go]);

  if (slides.length === 0)
    return all.length > 0 ? (
      <section aria-label="새로 들어온 글" className="rounded-[28px] bg-surface p-8 text-center">
        <p className="text-[19px] font-bold">새로 들어온 글을 모두 읽었어요</p>
        <p className="mt-1.5 text-sm text-ink-3">오른쪽 위 &lsquo;내가 읽은 글&rsquo;을 켜면 다시 볼 수 있어요.</p>
      </section>
    ) : null;

  return (
    <section
      aria-label="새로 들어온 글"
      aria-roledescription="carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="overflow-hidden rounded-[28px] bg-surface shadow-[0_2px_16px_rgba(0,0,0,0.04)]">
        <div ref={track} className="flex snap-x snap-mandatory overflow-x-auto scrollbar-none">
          {slides.map((s, i) => (
            <article
              key={s.id}
              className="w-full shrink-0 snap-center p-5 pb-6 md:p-8"
              aria-roledescription="slide"
              aria-label={`${i + 1} / ${slides.length}`}
            >
              <Visual s={s} />
              <p className="mt-6 flex items-center gap-2 text-sm font-semibold text-brand">
                <span className="rounded-full bg-brand-soft px-2 py-0.5 text-xs">NEW</span>
                {s.date}
                {s.internal && <span className="text-xs text-[#5b3fd1]">사내 운영·개발</span>}
                <ReadBadge id={s.id} />
              </p>
              <h2 className="mt-2 line-clamp-2 min-h-[2.6em] text-[26px] font-extrabold leading-[1.3] tracking-tight md:text-[30px]">
                {s.headline}
              </h2>
              <p className="mt-2 line-clamp-1 text-[15px] text-ink-3">
                {s.experience ? `${s.experience} · ` : ""}
                {s.title}
              </p>
              <Link
                href={`/articles/${s.id}`}
                className="mt-6 flex h-14 w-full items-center justify-center rounded-full bg-brand text-[17px] font-bold text-white transition hover:brightness-110"
              >
                읽으러 가기
              </Link>
            </article>
          ))}
        </div>
      </div>

      <div className="relative mt-4 flex items-center justify-center gap-3">
        {slides.length > 1 && (
          <>
            <button onClick={() => go((index - 1 + slides.length) % slides.length)} className="hidden px-1 text-ink-3 md:block" aria-label="이전 글">
              ‹
            </button>
            <div
              className="relative h-1 w-40 overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-label="새 글 위치"
              aria-valuemin={1}
              aria-valuemax={slides.length}
              aria-valuenow={index + 1}
            >
              <span
                className="absolute inset-y-0 rounded-full bg-ink-2 transition-all duration-300"
                style={{ width: `${100 / slides.length}%`, left: `${(100 / slides.length) * index}%` }}
              />
            </div>
            <button onClick={() => go((index + 1) % slides.length)} className="hidden px-1 text-ink-3 md:block" aria-label="다음 글">
              ›
            </button>
          </>
        )}
        <Link href="/feed" className="absolute right-0 text-sm font-semibold text-ink-3 hover:text-brand">
          전체 보기
        </Link>
      </div>
    </section>
  );
}
