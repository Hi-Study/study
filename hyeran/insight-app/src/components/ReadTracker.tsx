"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

// 상세 90% 스크롤 시 '다 읽음' 기록 (1회)
export default function ReadTracker({ postId, alreadyRead }: { postId: string; alreadyRead: boolean }) {
  const done = useRef(alreadyRead);

  useEffect(() => {
    if (done.current) return;
    const check = async () => {
      const el = document.documentElement;
      const ratio = (el.scrollTop + el.clientHeight) / el.scrollHeight;
      if (ratio < 0.9 || done.current) return;
      done.current = true;
      window.removeEventListener("scroll", check);
      const sb = createClient();
      const { data: { user } } = await sb.auth.getUser();
      if (user) await sb.from("reads").upsert({ user_id: user.id, post_id: postId }, { onConflict: "user_id,post_id" });
    };
    window.addEventListener("scroll", check, { passive: true });
    check(); // 짧은 글은 진입 즉시 충족
    return () => window.removeEventListener("scroll", check);
  }, [postId]);

  return null;
}
