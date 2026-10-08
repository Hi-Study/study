"use client";

import { useEffect, useRef, useState } from "react";

/**
 * "이런 문제를 어떻게 풀었을까요?" 가로 목록
 * - 휴대폰: 손가락으로 넘긴다 (브라우저 기본 가로 스크롤)
 * - 데스크톱: 마우스는 가로 스크롤을 못 하므로 양옆 화살표 + 끌어서 넘기기를 붙인다
 */
export function ProblemRail({ children }: { children: React.ReactNode }) {
  const track = useRef<HTMLDivElement>(null);
  const [edge, setEdge] = useState({ prev: false, next: false });
  const drag = useRef<{ x: number; left: number; moved: boolean } | null>(null);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const measure = () =>
      setEdge({ prev: el.scrollLeft > 4, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
    measure();
    el.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    // 읽은 글 숨김(ON/OFF)으로 카드 수가 바뀌어도 다시 잰다
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    const mo = new MutationObserver(measure);
    mo.observe(document.body, { attributes: true, subtree: true, attributeFilter: ["data-read-filter", "data-read"] });
    return () => {
      el.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      ro.disconnect();
      mo.disconnect();
    };
  }, []);

  // 화면에 보이는 카드 수만큼 넘긴다 (마지막 장이 반쯤 걸쳐 있으면 그 카드부터)
  const page = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * Math.max(el.clientWidth - 120, 280), behavior: "smooth" });
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || e.button !== 0 || !track.current) return;
    drag.current = { x: e.clientX, left: track.current.scrollLeft, moved: false };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    const el = track.current;
    if (!d || !el) return;
    const dx = e.clientX - d.x;
    if (!d.moved && Math.abs(dx) < 5) return;
    if (!d.moved) {
      d.moved = true;
      el.style.scrollSnapType = "none"; // 끄는 동안은 자석 맞춤을 끈다
      el.setPointerCapture(e.pointerId);
    }
    el.scrollLeft = d.left - dx;
  };
  const endDrag = () => {
    const el = track.current;
    if (el) el.style.scrollSnapType = "";
    // 끌기 직후의 click 이 카드 이동으로 이어지지 않도록 한 박자 뒤에 지운다
    setTimeout(() => (drag.current = null), 0);
  };
  const onClickCapture = (e: React.MouseEvent) => {
    if (drag.current?.moved) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const arrow = (dir: 1 | -1, show: boolean) => (
    <button
      type="button"
      onClick={() => page(dir)}
      aria-label={dir === 1 ? "다음 카드" : "이전 카드"}
      tabIndex={show ? 0 : -1}
      className={`absolute top-1/2 z-10 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-surface text-xl text-ink-2 shadow-[0_4px_16px_rgba(0,0,0,0.14)] transition hover:text-ink md:grid ${
        dir === 1 ? "-right-5" : "-left-5"
      } ${show ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      {dir === 1 ? "›" : "‹"}
    </button>
  );

  return (
    <div className="relative">
      {arrow(-1, edge.prev)}
      <div
        ref={track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onClickCapture={onClickCapture}
        onDragStart={(e) => e.preventDefault()}
        className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 scrollbar-none md:mx-0 md:scroll-px-0 md:px-0"
      >
        {children}
      </div>
      {arrow(1, edge.next)}
    </div>
  );
}
