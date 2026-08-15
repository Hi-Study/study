"use client";

import { useState } from "react";
import Link from "next/link";
import { CompanyLogo } from "@/components/PostCard";
import Icon from "@/components/Icon";
import type { Review } from "@/lib/types";

const RQ = ["인상 깊은 부분", "업무 적용", "인사이터에게 질문"] as const;

// 인사이트 카드(예외) — 좌 썸네일 + Q&A 전체(max+더보기). 카드 클릭 → 상세의 해당 인사이트로 포커싱
function ReviewCard({ r }: { r: Review }) {
  const [expanded, setExpanded] = useState(false);
  const answers = [r.q1, r.q2, r.q3];
  const clampable = answers.join("").length > 120;
  const stop = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };

  return (
    <Link href={`/posts/${r.post_id}?insight=${r.id}`} className="review ins-card">
      <div className="irow">
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
        </div>
      </div>

      <div className={`ins-qa${clampable && !expanded ? " clamp" : ""}`}>
        {RQ.map((label, i) => (
          <div className="rq" key={i}>
            <div className="q">{label}</div>
            {answers[i]?.trim()
              ? <div className="a">{answers[i]}</div>
              : <div className="a" style={{ color: "var(--text-sub)", opacity: 0.6 }}>미작성</div>}
          </div>
        ))}
      </div>

      <div className="ins-foot">
        {clampable && (
          <button className="ins-more" onClick={(e) => { stop(e); setExpanded((v) => !v); }}>
            {expanded ? "접기" : "더보기"}
          </button>
        )}
        <span className="ins-cmt"><Icon name="comment" size="sm" />댓글 {r.comment_count ?? 0}</span>
      </div>
    </Link>
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
