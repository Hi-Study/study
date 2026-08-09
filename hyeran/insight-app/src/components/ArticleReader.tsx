"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

type Hi = Record<number, string | null>; // sentence_idx → memo(없으면 null)

export default function ArticleReader({
  postId, body, initial,
}: {
  postId: string; body: string[]; initial: { sentence_idx: number; memo: string | null }[];
}) {
  const [hi, setHi] = useState<Hi>(() => {
    const m: Hi = {};
    initial.forEach((h) => { m[h.sentence_idx] = h.memo; });
    return m;
  });
  const [userId, setUserId] = useState<string | null>(null);
  const [active, setActive] = useState<number | null>(null);
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const sb = createClient();
  const has = (i: number) => Object.prototype.hasOwnProperty.call(hi, i);

  const highlight = async (i: number) => {
    if (!userId) return;
    setHi((h) => ({ ...h, [i]: null }));
    await sb.from("highlights").upsert({ user_id: userId, post_id: postId, sentence_idx: i, memo: null }, { onConflict: "user_id,post_id,sentence_idx" });
  };
  const unhighlight = async (i: number) => {
    if (!userId) return;
    setHi((h) => { const n = { ...h }; delete n[i]; return n; });
    setActive(null); setEditing(null);
    await sb.from("highlights").delete().match({ user_id: userId, post_id: postId, sentence_idx: i });
  };
  const saveMemo = async (i: number) => {
    if (!userId) return;
    const memo = draft.trim() || null;
    setHi((h) => ({ ...h, [i]: memo }));
    setEditing(null);
    await sb.from("highlights").upsert({ user_id: userId, post_id: postId, sentence_idx: i, memo }, { onConflict: "user_id,post_id,sentence_idx" });
  };
  const deleteMemo = async (i: number) => {
    if (!userId) return;
    setHi((h) => ({ ...h, [i]: null }));
    setEditing(null);
    await sb.from("highlights").upsert({ user_id: userId, post_id: postId, sentence_idx: i, memo: null }, { onConflict: "user_id,post_id,sentence_idx" });
  };

  const openEditor = (i: number) => { setDraft(hi[i] ?? ""); setEditing(i); };

  return (
    <div className="article">
      <div className="reader-hint">문장을 탭하면 하이라이트하거나 메모를 남길 수 있어요</div>
      {body.map((s, i) => (
        <div key={i}>
          <p className={has(i) ? "sent hl" : "sent"} onClick={() => { setActive(active === i ? null : i); setEditing(null); }}>
            {s}
            {hi[i] && <Icon name="memo" size="sm" />}
          </p>

          {hi[i] && editing !== i && <div className="memo-note">{hi[i]}</div>}

          {active === i && (
            editing === i ? (
              <div className="sent-editor">
                <textarea className="input" rows={2} autoFocus placeholder="이 문장에 메모"
                  value={draft} onChange={(e) => setDraft(e.target.value)} />
                <div className="sent-actions">
                  {has(i) && hi[i] && <button className="sa danger" onClick={() => deleteMemo(i)}>메모 삭제</button>}
                  <span style={{ flex: 1 }} />
                  <button className="sa" onClick={() => setEditing(null)}>취소</button>
                  <button className="sa on" onClick={() => saveMemo(i)}>저장</button>
                </div>
              </div>
            ) : (
              <div className="sent-actions">
                {has(i) ? (
                  <>
                    <button className="sa" onClick={() => openEditor(i)}>{hi[i] ? "메모 수정" : "메모 추가"}</button>
                    <button className="sa danger" onClick={() => unhighlight(i)}>하이라이트 해제</button>
                  </>
                ) : (
                  <>
                    <button className="sa on" onClick={() => highlight(i)}>하이라이트</button>
                    <button className="sa" onClick={() => { highlight(i); openEditor(i); }}>메모</button>
                  </>
                )}
              </div>
            )
          )}
        </div>
      ))}
    </div>
  );
}
