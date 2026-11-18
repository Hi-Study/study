"use client";

import { useEffect, useRef } from "react";
import { markHomeSection, track } from "@/lib/analytics";

/**
 * 홈 섹션 하나를 감싼다 — GA section_view · section_click 을 보낸다(구글 시트 「인사이트 GA 측정 설계」 이벤트 사전).
 * - section_view: 섹션이 화면에 절반 이상 보였을 때, 홈을 열 때마다 섹션별 한 번
 * - section_click: 섹션 안의 링크를 눌렀을 때(넘기기 화살표·탭 전환처럼 페이지를 옮기지 않는 버튼은 세지 않는다)
 * name: new_articles / experience / problem / tech
 */
export function TrackSection({ name, className, children }: { name: string; className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        // 섹션의 절반 이상이 보이거나, 섹션이 화면보다 커서 화면의 절반 이상을 채우면 "봤다"
        const seen = entries.some(
          (e) => e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= window.innerHeight * 0.5),
        );
        if (seen) {
          track("section_view", { section_name: name });
          io.disconnect();
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [name]);

  return (
    <section
      ref={ref}
      className={className}
      onClickCapture={(e) => {
        const link = (e.target as HTMLElement).closest("a");
        if (!link) return;
        track("section_click", { section_name: name });
        markHomeSection(name);
      }}
    >
      {children}
    </section>
  );
}
