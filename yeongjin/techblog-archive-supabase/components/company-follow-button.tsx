"use client";

import { cn } from "@/lib/utils";
import { Heart } from "lucide-react";
import { useState } from "react";

export function CompanyFollowButton({
  company,
  initialFollowing,
}: {
  company: string;
  initialFollowing: boolean;
}) {
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, setPending] = useState(false);

  const toggle = async () => {
    if (pending) return;
    setPending(true);
    const next = !following;
    setFollowing(next);
    try {
      const res = await fetch(`/api/companies/${encodeURIComponent(company)}/follow`, {
        method: "POST",
      });
      if (!res.ok) throw new Error();
    } catch {
      setFollowing(!next);
    } finally {
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={following}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs",
        following ? "border-primary text-primary" : "text-muted-foreground",
      )}
    >
      <Heart className={cn("h-3.5 w-3.5", following && "fill-current")} />
      {following ? "좋아요한 기업" : "이 기업 좋아요"}
    </button>
  );
}
