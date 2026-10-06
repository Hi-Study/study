"use client";

import { useEffect, useState } from "react";
import type { Learning } from "@/core/shared/types";

/** "✦ 기획자 관점 보기" 바텀시트 — 세로로 이어지는 고정 3섹션 */
export function PerspectiveSheet({ l }: { l: Learning }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<Record<number, number>>({});

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink py-4 text-[16px] font-bold text-white transition hover:bg-[#2b3340]"
      >
        <span className="text-[#9db0ff]">✦</span> 기획자 관점 보기
      </button>

      <div
        className={`fixed inset-0 z-40 bg-black/40 transition-opacity ${open ? "opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setOpen(false)}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="기획자 관점"
        className={`fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[88dvh] max-w-2xl overflow-y-auto rounded-t-3xl bg-surface shadow-2xl transition-transform duration-300 ${
          open ? "translate-y-0" : "translate-y-full"
        }`}
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-6 py-4">
          <p className="font-bold">✦ 기획자 관점</p>
          <button onClick={() => setOpen(false)} className="text-2xl leading-none text-ink-3" aria-label="닫기">
            ×
          </button>
        </div>

        <div className="space-y-10 px-6 pb-10 pt-6">
          <section>
            <h3 className="text-lg font-bold">핵심 변화</h3>
            <div className="mt-3 rounded-2xl bg-before p-4">
              <p className="text-xs font-bold tracking-wide text-ink-3">BEFORE</p>
              <p className="mt-1 leading-relaxed">{l.before}</p>
            </div>
            <div className="my-1 text-center text-ink-3">↓</div>
            <div className="rounded-2xl bg-after p-4">
              <p className="text-xs font-bold tracking-wide text-[var(--exp-ink)]">AFTER</p>
              <p className="mt-1 leading-relaxed">{l.after}</p>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {l.experiencePattern && (
                <span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
                  {l.experiencePattern}
                </span>
              )}
              {l.productPatterns.map((p) => (
                <span key={p} className="rounded-full border border-line px-3 py-1 text-sm text-ink-2">
                  {p}
                </span>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold">적용 관점</h3>
            <p className="mt-1 text-sm text-ink-3">정답이 아니라, 질문이에요</p>
            <ul className="mt-3 space-y-2">
              {l.plannerQuestions.map((q) => (
                <li key={q} className="flex gap-2 rounded-xl border border-line p-3 leading-relaxed">
                  <span className="text-brand">Q.</span>
                  {q}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-lg font-bold">적용 조건</h3>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-line p-4">
                <p className="text-sm font-bold text-[var(--exp-ink)]">기대할 수 있는 것</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[15px] leading-relaxed">
                  {l.tradeoffs.benefits.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-2xl border border-line p-4">
                <p className="text-sm font-bold text-[var(--problem-ink)]">함께 고려할 점</p>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-[15px] leading-relaxed">
                  {l.tradeoffs.considerations.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          {l.discussionQuestions.length > 0 && (
            <section>
              <h3 className="text-lg font-bold">같이 생각해 볼까요?</h3>
              <p className="mt-1 text-sm text-ink-3">정해진 답은 없어요. 내 생각에 가까운 쪽을 골라 보세요.</p>
              {l.discussionQuestions.map((d, qi) => (
                <div key={d.question} className="mt-3 rounded-2xl bg-bg p-4">
                  <p className="font-semibold leading-relaxed">{d.question}</p>
                  <div className="mt-3 flex flex-col gap-2">
                    {d.options.map((o, oi) => (
                      <button
                        key={o}
                        onClick={() => setPicked((p) => ({ ...p, [qi]: oi }))}
                        className={`rounded-xl border px-3 py-2.5 text-left text-[15px] transition ${
                          picked[qi] === oi ? "border-brand bg-brand-soft text-brand" : "border-line bg-surface"
                        }`}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          )}

          <p className="rounded-xl bg-bg p-3 text-xs leading-relaxed text-ink-3">
            이 화면의 내용은 AI가 원문을 분석해 만든 것이에요. 사실 관계는 원문에서 꼭 확인해 주세요.
          </p>
        </div>
      </div>
    </>
  );
}
