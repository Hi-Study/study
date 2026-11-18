"use client";

import { useEffect, useRef } from "react";
import { track, type TrackParams } from "@/lib/analytics";

/**
 * 감싼 영역이 화면에 절반 이상 보이면 GA 이벤트를 한 번 보낸다(화면을 열 때마다 한 번).
 * 영역이 화면보다 크면 화면의 절반 이상을 채웠을 때 "봤다"로 센다.
 * 예: 아티클의 정리 영역 → content_section_view (구글 시트 「인사이트 GA 측정 설계」 이벤트 사전)
 */
export function TrackView({
  event,
  params,
  className,
  children,
}: {
  event: string;
  params?: TrackParams;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  const key = JSON.stringify(params ?? {});

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.some(
          (e) => e.isIntersecting && (e.intersectionRatio >= 0.5 || e.intersectionRect.height >= window.innerHeight * 0.5),
        );
        if (seen) {
          track(event, JSON.parse(key));
          io.disconnect();
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75, 1] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [event, key]);

  return (
    <section ref={ref} className={className}>
      {children}
    </section>
  );
}
