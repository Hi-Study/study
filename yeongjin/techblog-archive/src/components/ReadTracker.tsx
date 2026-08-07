"use client";

import { useEffect, useRef } from "react";
import { recordPostViewAction, markPostReadAction } from "@/lib/actions/posts";

// 3.9 읽기 상태 — 진입 시 자동으로 "읽는 중", 스크롤 90% 도달 시 자동으로 "다 읽음"
export function ReadTracker({ postId, alreadyDone }: { postId: string; alreadyDone: boolean }) {
  const markedDone = useRef(alreadyDone);

  useEffect(() => {
    recordPostViewAction(postId).catch(() => {});
  }, [postId]);

  useEffect(() => {
    if (markedDone.current) return;

    function onScroll() {
      const scrollTop = window.scrollY;
      const viewportHeight = window.innerHeight;
      const fullHeight = document.documentElement.scrollHeight;
      const ratio = (scrollTop + viewportHeight) / fullHeight;

      if (ratio >= 0.9 && !markedDone.current) {
        markedDone.current = true;
        markPostReadAction(postId).catch(() => {});
      }
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [postId]);

  return null;
}
