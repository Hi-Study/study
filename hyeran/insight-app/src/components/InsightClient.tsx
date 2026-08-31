"use client";

import { useState } from "react";
import Link from "next/link";
import { CompanyLogo } from "@/components/PostCard";
import Icon from "@/components/Icon";
import ReviewLike from "@/components/ReviewLike";
import type { Review, CommunityPost } from "@/lib/types";

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
        <span style={{ flex: 1 }} />
        <ReviewLike reviewId={r.id} initialCount={r.like_count ?? 0} initialLiked={r.liked ?? false} />
        <span className="ins-cmt"><Icon name="comment" size="sm" />{r.comment_count ?? 0}</span>
      </div>
    </Link>
  );
}

// 커뮤니티 자유글 카드 → 자유글 상세
function CommunityCard({ p }: { p: CommunityPost }) {
  const img = p.media.find((m) => !/\.(mp4|webm|mov)$/i.test(m));
  return (
    <Link href={`/community/${p.id}`} className="cpost-card">
      <div className="cpost-main">
        <div className="cpost-head">
          <span className="avatar sm">{p.author?.initial ?? "?"}</span>
          <span className="irow-name">{p.author?.name ?? "인사이터"}</span>
          <span className="irow-date">{new Date(p.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</span>
        </div>
        <div className="cpost-title">{p.title}</div>
        {p.body && <div className="cpost-body">{p.body}</div>}
        <div className="ins-foot">
          <span style={{ flex: 1 }} />
          <span className="rlike"><Icon name="heart" size="sm" />{p.like_count ?? 0}</span>
          <span className="ins-cmt"><Icon name="comment" size="sm" />{p.comment_count ?? 0}</span>
        </div>
      </div>
      {img && <span className="cpost-thumb" style={{ backgroundImage: `url("${img}")` }} />}
    </Link>
  );
}

export default function InsightClient({ all, community }: { all: Review[]; community: CommunityPost[] }) {
  const [tab, setTab] = useState<"insight" | "community">("insight");

  return (
    <>
      <div className="utabs">
        <button className={`utab ${tab === "insight" ? "on" : ""}`} onClick={() => setTab("insight")}>인사이트</button>
        <button className={`utab ${tab === "community" ? "on" : ""}`} onClick={() => setTab("community")}>커뮤니티</button>
      </div>

      {tab === "insight" ? (
        all.length
          ? all.map((r) => <ReviewCard key={r.id} r={r} />)
          : <div className="empty"><div className="art" /><div className="msg">첫 인사이트를 남겨보세요</div></div>
      ) : (
        community.length
          ? community.map((p) => <CommunityCard key={p.id} p={p} />)
          : <div className="empty"><div className="art" /><div className="msg">첫 자유글을 남겨보세요</div><div className="sub">우측 하단 + 버튼으로 작성할 수 있어요</div></div>
      )}
    </>
  );
}
