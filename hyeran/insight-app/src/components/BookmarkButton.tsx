"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function BookmarkButton({ postId, initial }: { postId: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !on;
    setOn(next);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      if (next) await sb.from("bookmarks").insert({ user_id: user.id, post_id: postId });
      else await sb.from("bookmarks").delete().eq("user_id", user.id).eq("post_id", postId);
    }
    setBusy(false);
  };

  return (
    <button className="iconbtn" onClick={toggle} aria-label="북마크">
      <svg className="i" viewBox="0 0 24 24" style={{ fill: on ? "var(--blue)" : "none", stroke: on ? "var(--blue)" : "currentColor" }}>
        <path d="M6 3h12a1 1 0 011 1v17l-7-4.2L5 21V4a1 1 0 011-1z" />
      </svg>
    </button>
  );
}
