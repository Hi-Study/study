"use client";

import { useState } from "react";
import PostCard from "@/components/PostCard";
import type { Post } from "@/lib/types";

type Tab = "insight" | "comment" | "highlight";

export default function MyPostsClient({
  insights, comments, highlights,
}: {
  insights: Post[]; comments: Post[]; highlights: Post[];
}) {
  const [tab, setTab] = useState<Tab>("insight");
  const map: Record<Tab, { list: Post[]; label: string; empty: string }> = {
    insight: { list: insights, label: "인사이트", empty: "아직 독후감을 남긴 글이 없어요" },
    comment: { list: comments, label: "댓글", empty: "아직 댓글을 단 글이 없어요" },
    highlight: { list: highlights, label: "하이라이트", empty: "아직 하이라이트한 글이 없어요" },
  };
  const cur = map[tab];

  return (
    <>
      <div className="seg">
        {(Object.keys(map) as Tab[]).map((k) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
            {map[k].label} {map[k].list.length}
          </button>
        ))}
      </div>
      {cur.list.length ? (
        cur.list.map((p) => <PostCard key={p.id} post={p} />)
      ) : (
        <div className="empty"><div className="art" /><div className="msg">{cur.empty}</div></div>
      )}
    </>
  );
}
