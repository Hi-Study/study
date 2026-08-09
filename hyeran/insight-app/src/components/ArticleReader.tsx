"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import Icon from "@/components/Icon";

type Hi = Record<number, string | null>; // sentence_idx → memo(없으면 null)
const IMG = "::img::";

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
  const [memoIdx, setMemoIdx] = useState<number | null>(null); // 메모 모달 대상
  const [draft, setDraft] = useState("");

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const sb = createClient();
  const has = (i: number) => Object.prototype.hasOwnProperty.call(hi, i);

  const highlight = async (i: number) => {
    if (!userId) return;
    setHi((h) => ({ ...h, [i]: h[i] ?? null }));
    await sb.from("highlights").upsert({ user_id: userId, post_id: postId, sentence_idx: i, memo: null }, { onConflict: "user_id,post_id,sentence_idx" });
  };
  const unhighlight = async (i: number) => {
    if (!userId) return;
    setHi((h) => { const n = { ...h }; delete n[i]; return n; });
    setActive(null);
    await sb.from("highlights").delete().match({ user_id: userId, post_id: postId, sentence_idx: i });
  };
  const openMemo = (i: number) => { setDraft(hi[i] ?? ""); setActive(null); setMemoIdx(i); };
  const saveMemo = async () => {
    if (memoIdx === null || !userId) return;
    const i = memoIdx, memo = draft.trim() || null;
    setHi((h) => ({ ...h, [i]: memo }));
    setMemoIdx(null);
    await sb.from("highlights").upsert({ user_id: userId, post_id: postId, sentence_idx: i, memo }, { onConflict: "user_id,post_id,sentence_idx" });
  };
  const deleteMemo = async () => {
    if (memoIdx === null || !userId) return;
    const i = memoIdx;
    setHi((h) => ({ ...h, [i]: null }));
    setMemoIdx(null);
    await sb.from("highlights").upsert({ user_id: userId, post_id: postId, sentence_idx: i, memo: null }, { onConflict: "user_id,post_id,sentence_idx" });
  };

  return (
    <div className="article">
      <div className="reader-hint">문장을 탭하면 하이라이트하거나 메모를 남길 수 있어요</div>
      {body.map((s, i) =>
        s.startsWith(IMG) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} className="reader-img" src={s.slice(IMG.length)} alt="" loading="lazy" />
        ) : (
          <div key={i}>
            <p className={has(i) ? "sent hl" : "sent"} onClick={() => setActive(active === i ? null : i)}>
              <span>{s}</span>
              {hi[i] && (
                <button className="memo-ico" aria-label="메모 보기"
                  onClick={(e) => { e.stopPropagation(); openMemo(i); }}>
                  <Icon name="memo" size="sm" />
                </button>
              )}
            </p>

            {active === i && (
              <div className="sent-actions">
                {has(i) ? (
                  <>
                    <button className="sa" onClick={() => openMemo(i)}>{hi[i] ? "메모 보기·수정" : "메모 추가"}</button>
                    <button className="sa danger" onClick={() => unhighlight(i)}>하이라이트 해제</button>
                  </>
                ) : (
                  <>
                    <button className="sa on" onClick={() => highlight(i)}>하이라이트</button>
                    <button className="sa" onClick={() => { highlight(i); openMemo(i); }}>메모</button>
                  </>
                )}
              </div>
            )}
          </div>
        )
      )}

      {memoIdx !== null && (
        <>
          <div className="scrim show" onClick={() => setMemoIdx(null)} />
          <div className="memo-modal">
            <div className="mm-head"><Icon name="memo" size="sm" /> 메모</div>
            <div className="mm-quote">{body[memoIdx]}</div>
            <textarea className="input" rows={4} autoFocus placeholder="이 문장에 대한 메모"
              value={draft} onChange={(e) => setDraft(e.target.value)} />
            <div className="mm-row">
              {hi[memoIdx] && <button className="sa danger" onClick={deleteMemo}>메모 삭제</button>}
              <span style={{ flex: 1 }} />
              <button className="sa" onClick={() => setMemoIdx(null)}>취소</button>
              <button className="sa on" onClick={saveMemo}>저장</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
