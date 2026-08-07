"use client";

import { useState, useTransition } from "react";
import { toggleBookmarkAction } from "@/lib/actions/posts";

export function BookmarkButton({ postId, initialBookmarked }: { postId: string; initialBookmarked: boolean }) {
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        setBookmarked((v) => !v);
        startTransition(async () => {
          const result = await toggleBookmarkAction(postId);
          setBookmarked(result.bookmarked);
        });
      }}
      className={`inline-flex items-center gap-1 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        bookmarked
          ? "border-amber-400 bg-amber-50 text-amber-700 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-300"
          : "border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      <span>{bookmarked ? "★" : "☆"}</span>
      {bookmarked ? "저장됨" : "북마크"}
    </button>
  );
}
