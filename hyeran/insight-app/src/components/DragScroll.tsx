"use client";

import { useRef, type ReactNode } from "react";

// 가로 스크롤 영역을 마우스 드래그로도 밀 수 있게 해주는 래퍼.
// 터치(폰)는 브라우저 네이티브 가로 스크롤을 그대로 쓰고, 마우스만 드래그 처리한다.
export default function DragScroll({
  className,
  children,
  style,
}: {
  className?: string;
  children: ReactNode;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const s = useRef({ down: false, lock: null as null | "x" | "y", x: 0, y: 0, left: 0, moved: false });

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse") return; // 터치/펜은 네이티브 스크롤
    const el = ref.current;
    if (!el) return;
    s.current = { down: true, lock: null, x: e.clientX, y: e.clientY, left: el.scrollLeft, moved: false };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const st = s.current;
    if (!st.down) return;
    const el = ref.current;
    if (!el) return;
    const dx = e.clientX - st.x;
    const dy = e.clientY - st.y;
    if (!st.lock) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
      st.lock = Math.abs(dx) >= Math.abs(dy) ? "x" : "y";
      if (st.lock === "x") { try { el.setPointerCapture(e.pointerId); } catch {} }
    }
    if (st.lock === "x") {
      e.preventDefault();
      st.moved = true;
      el.scrollLeft = st.left - dx;
    }
  };

  const end = (e: React.PointerEvent) => {
    const st = s.current;
    if (st.lock === "x") { try { ref.current?.releasePointerCapture(e.pointerId); } catch {} }
    st.down = false;
    st.lock = null;
  };

  // 드래그로 스크롤한 경우엔 카드/칩의 클릭(링크 이동)을 막는다.
  const onClickCapture = (e: React.MouseEvent) => {
    if (s.current.moved) {
      e.preventDefault();
      e.stopPropagation();
      s.current.moved = false;
    }
  };

  return (
    <div
      ref={ref}
      className={className}
      style={{ cursor: "grab", ...style }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={end}
      onPointerCancel={end}
      onClickCapture={onClickCapture}
      onDragStart={(e) => e.preventDefault()}
    >
      {children}
    </div>
  );
}
