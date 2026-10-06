"use client";

import { useEffect, useRef, useState } from "react";
import type { Annotation, AnnKind } from "@/core/1-analyze/annotate";

export const KIND_LABEL: Record<AnnKind, { label: string; dot: string; chip: string }> = {
  problem: { label: "문제 정의", dot: "bg-[#f5c400]", chip: "bg-[var(--problem)] text-[var(--problem-ink)]" },
  technology: { label: "기술 이해", dot: "bg-[#60a5fa]", chip: "bg-[var(--tech)] text-[var(--tech-ink)]" },
  experience: { label: "경험 변화", dot: "bg-[#34c759]", chip: "bg-[var(--exp)] text-[var(--exp-ink)]" },
};

type Tip = { ann: Annotation; top: number; left: number };

/** 원문 전체 + 인라인 관점 하이라이트. 블록마다 id(b-N)를 달아 가이드의 근거로 이동할 수 있게 한다. */
export function ArticleBody({ blocks, anns }: { blocks: { n: number; html: string }[]; anns: Annotation[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [tip, setTip] = useState<Tip | null>(null);
  const byId = new Map(anns.map((a) => [a.id, a]));

  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const marks = (id: string) => root.querySelectorAll(`mark[data-ann="${id}"]`);
    const show = (el: HTMLElement) => {
      const ann = byId.get(el.dataset.ann ?? "");
      if (!ann) return;
      root.querySelectorAll("mark.active").forEach((m) => m.classList.remove("active"));
      marks(ann.id).forEach((m) => m.classList.add("active"));
      const r = el.getBoundingClientRect();
      const box = root.getBoundingClientRect();
      setTip({ ann, top: r.bottom - box.top + 8, left: Math.max(0, Math.min(r.left - box.left, box.width - 300)) });
    };
    const onClick = (e: MouseEvent) => {
      const m = (e.target as HTMLElement).closest("mark[data-ann]") as HTMLElement | null;
      if (m) show(m);
      else {
        setTip(null);
        root.querySelectorAll("mark.active").forEach((x) => x.classList.remove("active"));
      }
    };
    const onOver = (e: MouseEvent) => {
      if (!window.matchMedia("(hover: hover)").matches) return;
      const m = (e.target as HTMLElement).closest("mark[data-ann]") as HTMLElement | null;
      if (m) show(m);
    };
    root.addEventListener("click", onClick);
    root.addEventListener("mouseover", onOver);
    return () => {
      root.removeEventListener("click", onClick);
      root.removeEventListener("mouseover", onOver);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anns]);

  return (
    <div ref={ref} className="relative">
      <div className="prose-origin">
        {blocks.map((b) => (
          <div key={b.n} id={`b-${b.n}`} className="scroll-mt-24" dangerouslySetInnerHTML={{ __html: b.html }} />
        ))}
      </div>
      {tip && (
        <div
          className="absolute z-20 w-[300px] max-w-full rounded-xl border border-line bg-surface p-4 shadow-[0_10px_30px_rgba(0,0,0,0.12)]"
          style={{ top: tip.top, left: tip.left }}
          onClick={(e) => e.stopPropagation()}
        >
          <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold ${KIND_LABEL[tip.ann.kind].chip}`}>
            {KIND_LABEL[tip.ann.kind].label}
          </span>
          <p className="mt-2 text-[15px] font-bold leading-snug">{tip.ann.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-ink-2">{tip.ann.body}</p>
          <button onClick={() => setTip(null)} className="absolute right-2 top-2 px-2 text-ink-3" aria-label="닫기">
            ×
          </button>
        </div>
      )}
    </div>
  );
}
