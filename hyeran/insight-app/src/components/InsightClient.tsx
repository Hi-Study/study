"use client";

import { useState } from "react";
import Link from "next/link";
import CommentSheet from "@/components/CommentSheet";
import type { Review } from "@/lib/types";

const firstAnswer = (r: { q1: string; q2: string; q3: string }) =>
  r.q1?.trim() || r.q2?.trim() || r.q3?.trim() || "";

function ReviewCard({ r }: { r: Review }) {
  return (
    <div className="review">
      <Link href={`/posts/${r.post_id}`} style={{ display: "block" }}>
        <div className="who">
          <span className="avatar md">{r.author?.initial ?? "?"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 500 }}>{r.author?.name ?? "인사이터"}</div>
            <div className="meta mono">
              {new Date(r.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
            </div>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-sub)", margin: "2px 0 8px" }}>{r.post?.title}</div>
        <div className="rq"><div className="a">{firstAnswer(r)}</div></div>
      </Link>
      <CommentSheet
        reviewId={r.id}
        reviewAuthorId={r.author_id}
        count={r.comment_count ?? 0}
        preview={{ name: r.author?.name ?? "인사이터", initial: r.author?.initial ?? "?", text: firstAnswer(r) }}
      />
    </div>
  );
}

export default function InsightClient({ all, bookmarked }: { all: Review[]; bookmarked: Review[] }) {
  const [tab, setTab] = useState<"all" | "bookmark">("all");
  const list = tab === "all" ? all : bookmarked;
  const empty = tab === "all"
    ? "첫 인사이트를 남겨보세요"
    : "북마크한 글에 남겨진 인사이트가 없어요";

  return (
    <>
      <div className="seg">
        <button className={tab === "all" ? "on" : ""} onClick={() => setTab("all")}>전체</button>
        <button className={tab === "bookmark" ? "on" : ""} onClick={() => setTab("bookmark")}>
          북마크 {bookmarked.length}
        </button>
      </div>
      {list.length ? (
        list.map((r) => <ReviewCard key={r.id} r={r} />)
      ) : (
        <div className="empty"><div className="art" /><div className="msg">{empty}</div></div>
      )}
    </>
  );
}
