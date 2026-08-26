"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

// 범용 좋아요 토글 (likes: target_type/target_id)
export default function LikeButton({
  targetType, targetId, initialCount = 0, initialLiked = false, label = "좋아요",
}: {
  targetType: "review" | "comment" | "community_post";
  targetId: string;
  initialCount?: number;
  initialLiked?: boolean;
  label?: string;
}) {
  const [count, setCount] = useState(initialCount);
  const [liked, setLiked] = useState(initialLiked);
  const [busy, setBusy] = useState(false);

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (busy) return;
    setBusy(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setBusy(false); return; }
    const next = !liked;
    setLiked(next);
    setCount((c) => c + (next ? 1 : -1));
    if (next) await sb.from("likes").insert({ target_type: targetType, target_id: targetId, user_id: user.id });
    else await sb.from("likes").delete().eq("target_type", targetType).eq("target_id", targetId).eq("user_id", user.id);
    setBusy(false);
  };

  return (
    <button className={`rlike${liked ? " on" : ""}`} onClick={toggle} aria-label="좋아요">
      <Icon name="heart" size="sm" />{count > 0 ? count : label}
    </button>
  );
}
