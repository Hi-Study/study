"use client";

import { useEffect } from "react";
import { addFront, toggleIn, useLocalList } from "@/core/shared/local-store";

export function BookmarkButton({ id }: { id: number }) {
  const marks = useLocalList<number>("bookmarks");
  const on = marks.includes(id);
  return (
    <button
      onClick={() => toggleIn("bookmarks", id)}
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
  useEffect(() => addFront("read", id, 200), [id]);
  return null;
}
