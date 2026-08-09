"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

type Comment = { id: string; body: string; created_at: string; author?: { name: string; initial: string } | null };

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

  const load = async () => {
    setOpen(true);
    if (comments) return;
    const sb = createClient();
    const { data } = await sb
      .from("comments")
      .select("id, body, created_at, author:profiles(name, initial)")
      .eq("review_id", reviewId)
      .order("created_at", { ascending: true });
    setComments((data as unknown as Comment[]) ?? []);
  };

  const send = async () => {
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    if (user) {
      const { data } = await sb
        .from("comments")
        .insert({ review_id: reviewId, author_id: user.id, body })
        .select("id, body, created_at, author:profiles(name, initial)")
        .single();
      if (data) {
        setComments((c) => [...(c ?? []), data as unknown as Comment]);
        setCount((n) => n + 1);
        setText("");
        // 독후감 작성자에게 알림 (본인 제외)
        if (reviewAuthorId !== user.id) {
          await sb.from("notifications").insert({
            user_id: reviewAuthorId, type: "comment",
            title: "회원님의 독후감에 댓글이 달렸어요", body,
          });
        }
      }
    }
    setBusy(false);
  };

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
          ) : comments.length ? (
            comments.map((c) => (
              <div key={c.id} style={{ display: "flex", gap: 9, marginBottom: 14 }}>
                <span className="avatar">{c.author?.initial ?? "?"}</span>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{c.author?.name ?? "인사이터"}</div>
                  <div style={{ fontSize: 14, lineHeight: 1.5, marginTop: 2 }}>{c.body}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="hint">첫 댓글을 남겨보세요</div>
          )}
        </div>
        <div style={{ display: "flex", gap: 8, padding: "12px 16px calc(12px + env(safe-area-inset-bottom))", alignItems: "center" }}>
          <input className="input" style={{ borderRadius: "var(--r-chip)", flex: 1 }} placeholder="독후감에 댓글 달기"
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
