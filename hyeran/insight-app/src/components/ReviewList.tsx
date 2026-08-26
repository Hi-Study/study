"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import ReviewSheet from "@/components/ReviewSheet";
import ReviewLike from "@/components/ReviewLike";
import type { Review } from "@/lib/types";
import type { ThreadComment } from "@/lib/queries";

const RQ = ["인상 깊은 부분", "업무 적용", "인사이터에게 질문"] as const;
const SELECT = "id, review_id, parent_id, author_id, body, created_at, author:profiles!comments_author_id_fkey(name, initial)";

type ReplyTo = { id: string; name: string; authorId: string };

function rel(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export default function ReviewList({
  postId, reviews, comments: initialComments, userId, myInitial, focusReviewId,
}: {
  postId: string; reviews: Review[]; comments: ThreadComment[]; userId: string;
  myInitial: [string, string, string]; focusReviewId: string | null;
}) {
  const mine = reviews.find((r) => r.author_id === userId) ?? null;
  const others = reviews.filter((r) => r.author_id !== userId);

  const [comments, setComments] = useState<ThreadComment[]>(initialComments);
  const [replyTo, setReplyTo] = useState<Record<string, ReplyTo | null>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const sb = createClient();

  // 특정 인사이트로 포커싱 → 스크롤·강조 (v3.0: 접힘 없이 항상 전부 노출)
  useEffect(() => {
    if (!focusReviewId) return;
    const el = document.getElementById(`rv-${focusReviewId}`);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
    el.classList.add("rv-focus");
    const t = setTimeout(() => el.classList.remove("rv-focus"), 2200);
    return () => clearTimeout(t);
  }, [focusReviewId]);

  const rootsOf = (rid: string) => comments.filter((c) => c.review_id === rid && !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);
  const countFor = (rid: string) => comments.filter((c) => c.review_id === rid).length;

  const send = async (reviewId: string, reviewAuthorId: string) => {
    const body = (drafts[reviewId] ?? "").trim();
    if (!body || busy) return;
    setBusy(true);
    const rt = replyTo[reviewId] ?? null;
    let ins = await sb.from("comments").insert({ review_id: reviewId, author_id: userId, body, parent_id: rt?.id ?? null }).select(SELECT).single() as { data: unknown; error: unknown };
    if (ins.error) ins = await sb.from("comments").insert({ review_id: reviewId, author_id: userId, body }).select(SELECT).single() as { data: unknown; error: unknown };
    if (ins.data) {
      setComments((prev) => [...prev, { ...(ins.data as ThreadComment), like_count: 0, liked: false }]);
      setDrafts((d) => ({ ...d, [reviewId]: "" }));
      setReplyTo((r) => ({ ...r, [reviewId]: null }));
      const target = rt ? rt.authorId : reviewAuthorId;
      if (target !== userId) await sb.from("notifications").insert({ user_id: target, type: "comment", title: rt ? "회원님의 댓글에 답글이 달렸어요" : "회원님의 인사이트에 댓글이 달렸어요", body });
    }
    setBusy(false);
  };
  const toggleLike = async (c: ThreadComment) => {
    const liked = !c.liked;
    setComments((prev) => prev.map((x) => x.id === c.id ? { ...x, liked, like_count: x.like_count + (liked ? 1 : -1) } : x));
    if (liked) await sb.from("likes").insert({ target_type: "comment", target_id: c.id, user_id: userId });
    else await sb.from("likes").delete().eq("target_type", "comment").eq("target_id", c.id).eq("user_id", userId);
  };

  // 컴포넌트가 아니라 렌더 함수로 호출 → 리렌더 시 리마운트 안 됨(입력창 포커스 유지)
  const commentRow = (c: ThreadComment, reviewAuthorId: string, reviewId: string, reply?: boolean) => {
    const name = c.author?.name ?? "인사이터";
    return (
      <div key={c.id} className={`cmt${reply ? " reply" : ""}`}>
        <span className="avatar sm">{c.author?.initial ?? "?"}</span>
        <div className="cmt-body">
          <div className="cmt-head"><b>{name}</b>{c.author_id === reviewAuthorId && <span className="cmt-badge">작성자</span>}<span className="cmt-time">{rel(c.created_at)}</span></div>
          <div className="cmt-text">{c.body}</div>
          <div className="cmt-acts">
            {!reply && <button onClick={() => setReplyTo((r) => ({ ...r, [reviewId]: { id: c.id, name, authorId: c.author_id } }))}>답글 달기</button>}
            <button className={`cmt-like${c.liked ? " on" : ""}`} onClick={() => toggleLike(c)}><Icon name="heart" size="sm" />{c.like_count > 0 ? c.like_count : ""}</button>
          </div>
        </div>
      </div>
    );
  };

  const reviewCard = (r: Review, isMine: boolean) => {
    const rt = replyTo[r.id];
    return (
      <div key={r.id} id={`rv-${r.id}`} className={`review${isMine ? " mine" : ""}`}>
        <div className="who">
          <span className="avatar">{r.author?.initial ?? "?"}</span>
          <span style={{ fontSize: 13, fontWeight: 600 }}>{r.author?.name ?? "인사이터"}</span>
          <span className="meta mono" style={{ marginLeft: "auto" }}>{new Date(r.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</span>
          {isMine && <ReviewSheet postId={postId} initial={myInitial} trigger={<span className="kebab" aria-label="인사이트 수정"><Icon name="dots" /></span>} />}
        </div>
        {[r.q1, r.q2, r.q3].map((a, i) => (
          <div className="rq" key={i}><div className="q">{RQ[i]}</div>{a?.trim() ? <div className="a">{a}</div> : <div className="a" style={{ color: "var(--text-sub)", opacity: 0.6 }}>미작성</div>}</div>
        ))}
        <div className="rev-acts"><ReviewLike reviewId={r.id} initialCount={r.like_count ?? 0} initialLiked={r.liked ?? false} /></div>
        <div className="cmt-sec">
          <div className="cmt-title">댓글 및 토론 {countFor(r.id)}</div>
          {rootsOf(r.id).map((c) => (
            <div key={c.id}>{commentRow(c, r.author_id, r.id, false)}{repliesOf(c.id).map((rc) => commentRow(rc, r.author_id, r.id, true))}</div>
          ))}
          {rt && <div className="cmt-replybar">↳ {rt.name}님에게 답글<button className="reply-cancel" onClick={() => setReplyTo((x) => ({ ...x, [r.id]: null }))}>취소</button></div>}
          <div className="cmt-input bottom">
            <input value={drafts[r.id] ?? ""} placeholder={rt ? `${rt.name}님에게 답글` : "인사이트에 대한 의견을 남겨주세요…"}
              onChange={(e) => setDrafts((d) => ({ ...d, [r.id]: e.target.value }))} onKeyDown={(e) => { if (e.key === "Enter") send(r.id, r.author_id); }} />
            <button className="cmt-send" disabled={busy} onClick={() => send(r.id, r.author_id)}>등록</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* v3.0: 인사이트 탭 — 내 인사이트 먼저, 그다음 전부 노출(접힘 없음) */}
      {mine && reviewCard(mine, true)}
      {others.map((r) => reviewCard(r, false))}
      {!mine && others.length === 0 && (
        <div className="empty sm">
          <div className="msg">아직 인사이트가 없어요</div>
          <div className="sub">첫 인사이트를 남겨보세요</div>
        </div>
      )}
    </>
  );
}
