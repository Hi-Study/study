"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

type Comment = {
  id: string; body: string; created_at: string; parent_id: string | null;
  author_id: string; author?: { name: string; initial: string } | null;
};
type ReplyTo = { id: string; name: string; authorId: string };

const SELECT = "id, body, created_at, parent_id, author_id, author:profiles(name, initial)";
const SELECT_BASE = "id, body, created_at, author_id, author:profiles(name, initial)"; // parent_id 컬럼 없을 때 폴백

export default function CommentSheet({
  reviewId, reviewAuthorId, count: initialCount, preview,
}: {
  reviewId: string; reviewAuthorId: string; count: number;
  preview: { name: string; initial: string; text: string };
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [count, setCount] = useState(initialCount);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [replyTo, setReplyTo] = useState<ReplyTo | null>(null);

  const load = async () => {
    setOpen(true);
    if (comments) return;
    const sb = createClient();
    let res = await sb.from("comments").select(SELECT)
      .eq("review_id", reviewId).order("created_at", { ascending: true }) as { data: unknown; error: unknown };
    if (res.error) { // parent_id 컬럼 미적용 환경 폴백
      res = await sb.from("comments").select(SELECT_BASE)
        .eq("review_id", reviewId).order("created_at", { ascending: true }) as { data: unknown; error: unknown };
    }
    setComments((res.data as unknown as Comment[]) ?? []);
  };

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      let ins = await sb.from("comments")
        .insert({ review_id: reviewId, author_id: user.id, body, parent_id: replyTo?.id ?? null })
        .select(SELECT).single() as { data: unknown; error: unknown };
      if (ins.error) { // parent_id 컬럼 미적용 환경 폴백 (일반 댓글로 저장)
        ins = await sb.from("comments")
          .insert({ review_id: reviewId, author_id: user.id, body })
          .select(SELECT_BASE).single() as { data: unknown; error: unknown };
      }
      const data = ins.data;
      if (data) {
        setComments((c) => [...(c ?? []), data as unknown as Comment]);
        setCount((n) => n + 1);
        setText("");
        // 알림: 답글이면 상위 댓글 작성자, 아니면 독후감 작성자 (본인 제외)
        const target = replyTo ? replyTo.authorId : reviewAuthorId;
        if (target !== user.id) {
          await sb.from("notifications").insert({
            user_id: target, type: "comment",
            title: replyTo ? "회원님의 댓글에 답글이 달렸어요" : "회원님의 독후감에 댓글이 달렸어요",
            body,
          });
        }
        setReplyTo(null);
      }
    }
    setBusy(false);
  };

  const roots = (comments ?? []).filter((c) => !c.parent_id);
  const repliesOf = (id: string) => (comments ?? []).filter((c) => c.parent_id === id);

  const Row = ({ c, reply }: { c: Comment; reply?: boolean }) => (
    <div style={{ display: "flex", gap: 9, marginBottom: 12, marginLeft: reply ? 32 : 0 }}>
      <span className="avatar" style={reply ? { width: 22, height: 22, fontSize: 10 } : undefined}>{c.author?.initial ?? "?"}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 500 }}>{c.author?.name ?? "인사이터"}</div>
        <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 2 }}>{c.body}</div>
        {!reply && (
          <button className="reply-btn"
            onClick={() => setReplyTo({ id: c.id, name: c.author?.name ?? "인사이터", authorId: c.author_id })}>
            답글 달기
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button className="foot-btn" onClick={load}>
        <Icon name="comment" size="sm" /> 댓글 {count}
      </button>

      {open && <div className="scrim show" onClick={() => setOpen(false)} />}
      <div className={`drawer ${open ? "show" : ""}`}>
        <div className="handle" />
        <div className="dhead">독후감 댓글 {count}<button className="iconbtn" style={{ marginLeft: "auto" }} onClick={() => setOpen(false)}><Icon name="x" /></button></div>
        <div className="dbody">
          <div className="review" style={{ background: "transparent", padding: "0 0 12px", marginBottom: 12, borderBottom: "1px solid var(--card-strong)" }}>
            <div className="who"><span className="avatar">{preview.initial}</span><span style={{ fontSize: 13, fontWeight: 500 }}>{preview.name}</span></div>
            <div className="rq"><div className="a">{preview.text}</div></div>
          </div>
          {comments === null ? (
            <div className="hint">불러오는 중…</div>
          ) : roots.length ? (
            roots.map((c) => (
              <div key={c.id}>
                <Row c={c} />
                {repliesOf(c.id).map((r) => <Row key={r.id} c={r} reply />)}
              </div>
            ))
          ) : (
            <div className="hint">첫 댓글을 남겨보세요</div>
          )}
        </div>
        {replyTo && (
          <div className="reply-bar">
            <Icon name="comment" size="sm" />{replyTo.name}님에게 답글
            <button className="iconbtn" style={{ marginLeft: "auto", width: 24, height: 24 }} onClick={() => setReplyTo(null)}><Icon name="x" size="sm" /></button>
          </div>
        )}
        <div style={{ display: "flex", gap: 8, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", alignItems: "center" }}>
          <input className="input" style={{ borderRadius: "var(--r-chip)", flex: 1 }}
            placeholder={replyTo ? `${replyTo.name}님에게 답글 달기` : "독후감에 댓글 달기"}
            value={text} onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") send(); }} />
          <button onClick={send} disabled={busy}
            style={{ width: 40, height: 40, borderRadius: "50%", background: "var(--blue)", color: "#fff", border: "none", flex: "0 0 auto", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon name="send" size="sm" />
          </button>
        </div>
      </div>
    </>
  );
}
