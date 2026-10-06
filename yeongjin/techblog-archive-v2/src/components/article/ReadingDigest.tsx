"use client";

import { useState } from "react";
import type { ReadingGuide } from "@/core/shared/types";

type QuoteBlock = { n: number; text: string; heading: boolean };

/** 소제목 블록이거나 25자 미만이면 펼쳐도 볼 게 없어 인용하지 않는다 */
function quoteAt(blocks: QuoteBlock[], n: number): QuoteBlock | null {
  const b = blocks[n - 1];
  if (!b || b.heading || b.text.length < 25) return null;
  return b;
}

function goToBlock(n: number) {
  const el = document.getElementById(`b-${n}`);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.remove("block-flash");
  void el.offsetWidth;
  el.classList.add("block-flash");
}

const LEAD_LABEL: [keyof ReadingGuide["lead"], string][] = [
  ["what", "무엇을 했대요?"],
  ["why", "왜 했대요?"],
  ["how", "어떻게 했대요?"],
  ["soWhat", "그래서 어떻게 됐대요?"],
];

/** "더 들어가 볼까요?" — 한눈에(lead) · 기획 포인트 · 질문형 소제목 칸 */
export function ReadingDigest({ guide, blocks }: { guide: ReadingGuide; blocks: QuoteBlock[] }) {
  const [open, setOpen] = useState<number | null>(0);
  const [quotes, setQuotes] = useState<Record<number, boolean>>({});
  const terms = new Map(guide.terms.map((t) => [t.term, t.plain]));

  return (
    <section className="rounded-3xl border border-line bg-surface p-5 md:p-7">
      <p className="text-xs font-bold tracking-wide text-brand">READING GUIDE</p>
      <h2 className="mt-1 text-xl font-bold">한눈에 보기</h2>
      <dl className="mt-4 grid gap-3 md:grid-cols-2">
        {LEAD_LABEL.filter(([k]) => guide.lead[k]).map(([k, label]) => (
          <div key={k} className="rounded-2xl bg-bg p-4">
            <dt className="text-xs font-bold text-ink-3">{label}</dt>
            <dd className="mt-1 leading-relaxed">{guide.lead[k]}</dd>
          </div>
        ))}
      </dl>

      {guide.points.length > 0 && (
        <div className="mt-5">
          <p className="text-sm font-bold">기획 포인트</p>
          <ul className="mt-2 space-y-1.5">
            {guide.points.map((p) => (
              <li key={p} className="flex gap-2 leading-relaxed">
                <span className="text-brand">✓</span>
                {p}
              </li>
            ))}
          </ul>
        </div>
      )}

      <h2 className="mt-9 text-xl font-bold">더 들어가 볼까요?</h2>
      <p className="mt-1 text-sm text-ink-3">글이 이야기한 순서대로, 질문 하나에 국면 하나씩</p>
      <div className="mt-4 space-y-2.5">
        {guide.sections.map((s, i) => {
          const isOpen = open === i;
          const qs = s.blocks.map((n) => quoteAt(blocks, n)).filter((b): b is QuoteBlock => !!b);
          return (
            <div key={i} className={`rounded-2xl border transition ${isOpen ? "border-ink/20 shadow-sm" : "border-line"}`}>
              <button
                onClick={() => setOpen(isOpen ? null : i)}
                className="flex w-full items-center gap-3 px-4 py-4 text-left"
                aria-expanded={isOpen}
              >
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-sm font-bold text-brand">
                  {i + 1}
                </span>
                <span className="flex-1 text-[16px] font-bold leading-snug">{s.question}</span>
                <span className={`text-ink-3 transition ${isOpen ? "rotate-180" : ""}`}>⌄</span>
              </button>
              {isOpen && (
                <div className="px-4 pb-5 md:pl-14">
                  {s.problem && (
                    <p className="rounded-xl bg-[var(--problem)]/60 px-3 py-2 text-[15px] leading-relaxed">
                      <span className="mr-1.5 font-bold text-[var(--problem-ink)]">문제</span>
                      {s.problem}
                    </p>
                  )}
                  <div className="mt-3 space-y-2.5">
                    {s.paras.map((p) => (
                      <p key={p} className="leading-[1.8] text-ink">
                        {p}
                      </p>
                    ))}
                  </div>
                  {s.outcome && (
                    <p className="mt-3 rounded-xl bg-after px-3 py-2 text-[15px] leading-relaxed">
                      <span className="mr-1.5 font-bold text-[var(--exp-ink)]">결말</span>
                      {s.outcome}
                    </p>
                  )}
                  {s.terms.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {s.terms.map((t) => (
                        <span
                          key={t}
                          title={terms.get(t)}
                          className="group relative cursor-help rounded-md border border-dashed border-ink-3/50 px-2 py-0.5 text-xs text-ink-2"
                        >
                          {t}
                          {terms.get(t) && (
                            <span className="pointer-events-none absolute bottom-full left-0 z-10 mb-1 hidden w-56 rounded-lg bg-ink p-2 text-xs leading-relaxed text-white group-hover:block">
                              {terms.get(t)}
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                  {qs.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => setQuotes((q) => ({ ...q, [i]: !q[i] }))}
                        className="text-sm font-semibold text-ink-2 underline underline-offset-4"
                      >
                        {quotes[i] ? "근거 원문 접기" : `근거 원문 ${qs.length}곳 펼치기`}
                      </button>
                      {quotes[i] && (
                        <div className="mt-2 space-y-2">
                          {qs.map((b) => (
                            <blockquote key={b.n} className="border-l-2 border-ink/20 pl-3 text-sm leading-relaxed text-ink-2">
                              {b.text}
                              <button onClick={() => goToBlock(b.n)} className="ml-2 whitespace-nowrap text-xs font-semibold text-brand">
                                본문에서 보기 ↓
                              </button>
                            </blockquote>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
