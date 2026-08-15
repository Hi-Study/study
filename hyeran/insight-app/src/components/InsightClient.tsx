"use client";

import { useState } from "react";
import Link from "next/link";
import CommentSheet from "@/components/CommentSheet";
import { CompanyLogo } from "@/components/PostCard";
import type { Review } from "@/lib/types";

const firstAnswer = (r: { q1: string; q2: string; q3: string }) =>
  r.q1?.trim() || r.q2?.trim() || r.q3?.trim() || "";

// 인사이트 카드(예외) — 좌: 글 썸네일 / 우: 작성자·글제목·감상. 통일 카드 아님(감상 피드)
function ReviewCard({ r }: { r: Review }) {
  return (
    <div className="review">
      <Link href={`/posts/${r.post_id}`} className="irow">
        <span className="irow-thumb"><CompanyLogo company={r.post?.company} /></span>
        <div className="irow-body">
          <div className="irow-head">
            <span className="avatar sm">{r.author?.initial ?? "?"}</span>
            <span className="irow-name">{r.author?.name ?? "인사이터"}</span>
            <span className="irow-date">
              {new Date(r.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}
            </span>
          </div>
          <div className="irow-post">{r.post?.title}</div>
          <div className="irow-insight">{firstAnswer(r)}</div>
        </div>
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
      <div className="utabs">
        <button className={`utab ${tab === "all" ? "on" : ""}`} onClick={() => setTab("all")}>전체</button>
        <button className={`utab ${tab === "bookmark" ? "on" : ""}`} onClick={() => setTab("bookmark")}>북마크</button>
      </div>
      {list.length ? (
        list.map((r) => <ReviewCard key={r.id} r={r} />)
      ) : (
        <div className="empty"><div className="art" /><div className="msg">{empty}</div></div>
      )}
    </>
  );
}
