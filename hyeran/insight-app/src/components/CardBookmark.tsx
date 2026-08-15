"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// 카드 위 북마크 토글. 카드가 Link라 클릭 전파를 막고, 비로그인 시 로그인 안내.
// variant: "cover" = 커버 위 어두운 원 / "plain" = 흰 목록용 아이콘
export default function CardBookmark({ postId, initial = false, variant = "cover" }: { postId: string; initial?: boolean; variant?: "cover" | "plain" }) {
  const router = useRouter();
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [needLogin, setNeedLogin] = useState(false);

  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  const toggle = async (e: React.MouseEvent) => {
    stop(e);
    if (busy) return;
    setBusy(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) { setNeedLogin(true); setBusy(false); return; }
    const next = !on;
    setOn(next);
    if (next) await sb.from("bookmarks").insert({ user_id: user.id, post_id: postId });
    else await sb.from("bookmarks").delete().eq("user_id", user.id).eq("post_id", postId);
    setBusy(false);
  };

  return (
    <>
      <button className={`card-bm ${variant}`} data-on={on} aria-label="북마크" onClick={toggle}>
        <svg viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 011 1v17l-7-4.2L5 21V4a1 1 0 011-1z" /></svg>
      </button>

      {needLogin && (
        <>
          <div className="scrim show" onClick={(e) => { stop(e); setNeedLogin(false); }} />
          <div className="confirm-box" onClick={stop}>
            <div className="ct">로그인이 필요해요</div>
            <div className="cs">북마크는 로그인 후 이용할 수 있어요</div>
            <div className="crow">
              <button className="btn btn-outline" onClick={(e) => { stop(e); setNeedLogin(false); }}>닫기</button>
              <button className="btn btn-primary" onClick={(e) => { stop(e); router.push("/"); }}>로그인</button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
