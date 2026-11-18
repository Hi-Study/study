"use client";

import { useEffect } from "react";
import { addFront, toggleIn, useLocalList } from "@/core/shared/local-store";
import { cameFromUrl } from "@/components/common/BackNav";
import { entrySourceOf, track } from "@/lib/analytics";

export function BookmarkButton({ id }: { id: number }) {
  const marks = useLocalList<number>("bookmarks");
  const on = marks.includes(id);
  return (
    <button
      onClick={() => {
        // GA — 저장 안 된 글을 저장할 때만 article_save (저장 취소는 세지 않는다)
        if (!on) track("article_save");
        toggleIn("bookmarks", id);
      }}
      className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
        on ? "border-brand bg-brand-soft text-brand" : "border-line text-ink-2 hover:border-ink-3"
      }`}
      aria-pressed={on}
    >
      {on ? "★ 저장됨" : "☆ 저장"}
    </button>
  );
}

/** 상세 화면에 들어오면 읽은 글로 기록 */
export function MarkRead({ id }: { id: number }) {
  useEffect(() => addFront("read", id), [id]);
  // GA — 글 상세를 볼 때마다 article_view. entry_source 는 바로 앞 화면으로 정한다(구글 시트 이벤트 사전)
  useEffect(() => {
    track("article_view", { entry_source: entrySourceOf(cameFromUrl()) });
  }, [id]);
  return null;
}
