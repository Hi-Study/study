"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

// 인사이트(리뷰) 좋아요 토글. 카드 Link 안에서도 쓰이므로 클릭 전파 차단.
export default function ReviewLike({ reviewId, initialCount = 0, initialLiked = false }: { reviewId: string; initialCount?: number; initialLiked?: boolean }) {
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
    if (next) await sb.from("likes").insert({ target_type: "review", target_id: reviewId, user_id: user.id });
    else await sb.from("likes").delete().eq("target_type", "review").eq("target_id", reviewId).eq("user_id", user.id);
    setBusy(false);
  };

  return (
    <button className={`rlike${liked ? " on" : ""}`} onClick={toggle} aria-label="좋아요">
      <Icon name="heart" size="sm" />{count > 0 ? count : "좋아요"}
    </button>
  );
}
