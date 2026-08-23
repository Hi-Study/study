"use client";

import { Bookmark } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

export function BookmarkButton({
  articleId,
  initialBookmarked,
  initialCount,
  variant = "compact",
}: {
  articleId: string;
  initialBookmarked: boolean;
  initialCount: number;
  variant?: "compact" | "pill";
}) {
  const router = useRouter();
  const [bookmarked, setBookmarked] = useState(initialBookmarked);
  const [count, setCount] = useState(initialCount);
  const [pending, setPending] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const next = !bookmarked;
    setBookmarked(next);
    setCount((c) => c + (next ? 1 : -1));
    try {
      const res = await fetch(`/api/articles/${articleId}/bookmark`, { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setBookmarked(!next);
      setCount((c) => c + (next ? -1 : 1));
    } finally {
      setPending(false);
    }
  };

  if (variant === "pill") {
    return (
      <button
        onClick={toggle}
        className={cn(
          "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs",
          bookmarked ? "border-primary text-primary" : "text-muted-foreground",
        )}
        aria-pressed={bookmarked}
        aria-label="북마크"
      >
        <Bookmark className={cn("h-3.5 w-3.5", bookmarked && "fill-current")} />
        {bookmarked ? "북마크됨" : "북마크"} {count}
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={cn(
        "flex items-center gap-1 text-xs",
        bookmarked ? "text-primary" : "text-muted-foreground",
      )}
      aria-pressed={bookmarked}
      aria-label="북마크"
    >
      <Bookmark className={cn("h-3.5 w-3.5", bookmarked && "fill-current")} /> {count}
    </button>
  );
}
