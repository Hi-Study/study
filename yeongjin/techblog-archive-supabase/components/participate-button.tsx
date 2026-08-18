"use client";

import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ParticipateButton({
  articleId,
  initialJoined,
}: {
  articleId: string;
  initialJoined: boolean;
}) {
  const router = useRouter();
  const [joined, setJoined] = useState(initialJoined);
  const [pending, setPending] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (pending) return;
    setPending(true);
    const next = !joined;
    setJoined(next);
    try {
      const res = await fetch(`/api/articles/${articleId}/participate`, { method: "POST" });
      if (!res.ok) throw new Error();
      router.refresh();
    } catch {
      setJoined(!next);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={cn(
        "shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors",
        joined
          ? "border border-primary text-primary"
          : "bg-primary text-primary-foreground hover:bg-primary/90",
      )}
    >
      {joined ? "참여 중" : "참여하기"}
    </button>
  );
}
