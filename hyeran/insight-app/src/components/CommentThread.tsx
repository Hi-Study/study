"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";
import type { ThreadComment } from "@/lib/queries";

const SELECT = "id, target_id, parent_id, author_id, body, created_at, author:profiles!comments_author_id_fkey(name, initial)";

type ReplyTo = { id: string; name: string; authorId: string };

function rel(iso: string) {
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

// 범용 댓글 스레드 (단일 대상: target_type/target_id) — 자유글 등
export default function CommentThread({
  targetType, targetId, ownerId, initial, userId,
}: {
  targetType: "community_post" | "review";
  targetId: string;
  ownerId: string;
  initial: ThreadComment[];
  userId: string;
}) {
  const [comments, setComments] = useState<ThreadComment[]>(initial);
  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);
  const [busy, setBusy] = useState(false);
  const sb = createClient();

  const roots = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  const send = async () => {
    const body = draft.trim();
    if (!body || busy) return;
    setBusy(true);
    const ins = await sb.from("comments")
      .insert({ target_type: targetType, target_id: targetId, author_id: userId, body, parent_id: replyTo?.id ?? null })
      .select(SELECT).single() as { data: unknown };
    if (ins.data) {
      setComments((prev) => [...prev, { ...(ins.data as ThreadComment), like_count: 0, liked: false }]);
      setDraft(""); const rt = replyTo; setReplyTo(null);
      const target = rt ? rt.authorId : ownerId;
      if (target !== userId) await sb.from("notifications").insert({ user_id: target, type: "comment", title: rt ? "회원님의 댓글에 답글이 달렸어요" : "회원님의 자유글에 댓글이 달렸어요", body });
    }
    setBusy(false);
  };

  const toggleLike = async (c: ThreadComment) => {
    const liked = !c.liked;
    setComments((prev) => prev.map((x) => x.id === c.id ? { ...x, liked, like_count: x.like_count + (liked ? 1 : -1) } : x));
    if (liked) await sb.from("likes").insert({ target_type: "comment", target_id: c.id, user_id: userId });
    else await sb.from("likes").delete().eq("target_type", "comment").eq("target_id", c.id).eq("user_id", userId);
  };

  const row = (c: ThreadComment, reply?: boolean) => {
    const name = c.author?.name ?? "인사이터";
    return (
      <div key={c.id} className={`cmt${reply ? " reply" : ""}`}>
        <span className="avatar sm">{c.author?.initial ?? "?"}</span>
        <div className="cmt-body">
          <div className="cmt-head"><b>{name}</b>{c.author_id === ownerId && <span className="cmt-badge">작성자</span>}<span className="cmt-time">{rel(c.created_at)}</span></div>
          <div className="cmt-text">{c.body}</div>
          <div className="cmt-acts">
            {!reply && <button onClick={() => setReplyTo({ id: c.id, name, authorId: c.author_id })}>답글 달기</button>}
            <button className={`cmt-like${c.liked ? " on" : ""}`} onClick={() => toggleLike(c)}><Icon name="heart" size="sm" />{c.like_count > 0 ? c.like_count : ""}</button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="cmt-sec">
      <div className="cmt-title">댓글 및 토론 {comments.length}</div>
      <div className="cmt-input">
        <input value={draft} placeholder={replyTo ? `${replyTo.name}님에게 답글` : "댓글을 남겨주세요…"}
          onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
        <button className="cmt-send" disabled={busy} onClick={send}>등록</button>
      </div>
      {replyTo && <div className="cmt-replybar">↳ {replyTo.name}님에게 답글<button className="reply-cancel" onClick={() => setReplyTo(null)}>취소</button></div>}
      {roots.map((c) => (
        <div key={c.id}>{row(c)}{repliesOf(c.id).map((rc) => row(rc, true))}</div>
      ))}
    </div>
  );
}
