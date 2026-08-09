"use client";

import { useState } from "react";
import PostCard from "@/components/PostCard";
import type { Post } from "@/lib/types";

export default function MyPostsClient({ insights, comments }: { insights: Post[]; comments: Post[] }) {
  const [tab, setTab] = useState<"insight" | "comment">("insight");
  const list = tab === "insight" ? insights : comments;
  const empty = tab === "insight" ? "아직 독후감을 남긴 글이 없어요" : "아직 댓글을 단 글이 없어요";

  return (
    <>
      <div className="seg">
        <button className={tab === "insight" ? "on" : ""} onClick={() => setTab("insight")}>인사이트 남긴 글</button>
        <button className={tab === "comment" ? "on" : ""} onClick={() => setTab("comment")}>댓글 단 글</button>
      </div>
      {list.length ? (
        list.map((p) => <PostCard key={p.id} post={p} />)
      ) : (
        <div className="empty"><div className="art" /><div className="msg">{empty}</div></div>
      )}
    </>
  );
}
