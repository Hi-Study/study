"use client";

import { useState } from "react";
import PostCard from "./PostCard";
import type { FeedPost } from "@/lib/types";

export default function FeedList({ posts }: { posts: FeedPost[] }) {
  const [tab, setTab] = useState<"all" | "curated">("all");
  const shown = tab === "curated" ? posts.filter((p) => p.talkCount >= 1) : posts;

  return (
    <>
      <div className="segment">
        <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
          전체 피드
        </button>
        <button className={tab === "curated" ? "active" : ""} onClick={() => setTab("curated")}>
          큐레이션 피드
        </button>
      </div>
      <div className="content">
        <div className="feed-list">
          {shown.length === 0 && <div className="empty-state">아직 등록된 글이 없어요.</div>}
          {shown.map((p) => (
            <PostCard key={p.id} post={p} highlightTalk={tab === "curated"} />
          ))}
        </div>
      </div>
    </>
  );
}
