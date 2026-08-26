"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { summarizeSentence } from "@/lib/reader-actions";
import Icon from "@/components/Icon";

type Hi = Record<number, string | null>; // block_idx → memo(없으면 null)
const IMG = "::img::";
// 블록 타입 → 렌더 태그 (li 는 ul 없이 bullet 스타일로)
const TAGS: Record<string, string> = { h2: "h2", h3: "h3", p: "p", quote: "blockquote", code: "pre", cap: "figcaption", li: "div" };
function parseBlock(s: string): { type: string; text: string } {
  const m = s.match(/^::(h2|h3|p|li|quote|code|cap)::/);
  if (m) return { type: m[1], text: s.slice(m[0].length) };
  return { type: "p", text: s }; // 구식(평문) 호환
}

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
  const [aiIdx, setAiIdx] = useState<number | null>(null);   // AI 요약 모달 대상
  const [aiText, setAiText] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [wordIdx, setWordIdx] = useState<number | null>(null); // 단어 담기 모달 대상
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set());
  const [resumeIdx, setResumeIdx] = useState<number>(0); // 이어읽기 대상 블록
  const rootRef = useRef<HTMLDivElement>(null);
  const savedIdx = useRef(0);       // 마지막으로 저장한 블록
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // 저장된 이어읽기 위치 로드
  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await createClient()
        .from("reading_progress").select("block_idx")
        .eq("user_id", userId).eq("post_id", postId).maybeSingle();
      const idx = (data as { block_idx?: number } | null)?.block_idx ?? 0;
      savedIdx.current = idx;
      if (idx > 2) setResumeIdx(idx); // 초반이면 이어읽기 불필요
    })();
  }, [userId, postId]);

  // 스크롤 추적 → 현재 읽는 블록을 reading_progress에 저장 (원문 탭이 보일 때만)
  useEffect(() => {
    if (!userId) return;
    const onScroll = () => {
      const root = rootRef.current;
      if (!root || root.offsetParent === null) return; // 인사이트 탭이면 숨김 → 스킵
      const blocks = root.querySelectorAll<HTMLElement>("[data-blk]");
      let cur = 0;
      for (const b of blocks) {
        if (b.getBoundingClientRect().top <= 140) cur = Number(b.dataset.blk);
        else break;
      }
      // 이어읽기 지점을 지나면 FAB 숨김
      if (resumeIdx && cur >= resumeIdx - 1) setResumeIdx(0);
      if (cur === savedIdx.current) return;
      savedIdx.current = cur;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        createClient().from("reading_progress").upsert(
          { user_id: userId, post_id: postId, block_idx: cur, updated_at: new Date().toISOString() },
          { onConflict: "user_id,post_id" },
        );
      }, 700);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [userId, postId, resumeIdx]);

  const resume = () => {
    document.getElementById(`blk-${resumeIdx}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setResumeIdx(0);
  };

  // AI 요약 (문장 → 한 줄 요약)
  const openAi = async (i: number) => {
    setActive(null); setAiIdx(i); setAiText(""); setAiLoading(true);
    const out = await summarizeSentence(parseBlock(body[i]).text);
    setAiText(out); setAiLoading(false);
  };

  // 단어 담기 (문장 속 단어 → 단어장)
  const wordsOf = (text: string) =>
    [...new Set(text.split(/[\s,.·…"'“”‘’()[\]{}!?:;~\-—/\\|]+/).map((w) => w.trim()).filter((w) => w.length >= 2))].slice(0, 40);
  const openWords = (i: number) => { setActive(null); setWordIdx(i); };
  const saveWord = async (term: string, i: number) => {
    if (!userId || savedWords.has(term)) return;
    setSavedWords((s) => new Set(s).add(term));
    await sb.from("words").upsert(
      { user_id: userId, term, post_id: postId, sentence_idx: i },
      { onConflict: "user_id,term" },
    );
  };

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
    <div className="article" ref={rootRef}>
      <div className="reader-hint">문단을 탭하면 하이라이트하거나 메모를 남길 수 있어요</div>
      {body.map((s, i) => {
        if (s.startsWith(IMG)) {
          // eslint-disable-next-line @next/next/no-img-element
          return <img key={i} id={`blk-${i}`} data-blk={i} className="reader-img" src={s.slice(IMG.length)} alt="" loading="lazy" />;
        }
        const { type, text } = parseBlock(s);
        const Tag = (TAGS[type] || "p") as keyof React.JSX.IntrinsicElements;
        return (
          <div key={i} id={`blk-${i}`} data-blk={i}>
            <Tag className={`artblk art-${type}${has(i) ? " hl" : ""}`} onClick={() => setActive(active === i ? null : i)}>
              <span>{text}</span>
              {hi[i] && (
                <button className="memo-ico" aria-label="메모 보기"
                  onClick={(e) => { e.stopPropagation(); openMemo(i); }}>
                  <Icon name="memo" size="sm" />
                </button>
              )}
            </Tag>

            {active === i && (
              <div className="sent-actions">
                {has(i)
                  ? <button className="sa danger" onClick={() => unhighlight(i)}>하이라이트 해제</button>
                  : <button className="sa on" onClick={() => highlight(i)}>하이라이트</button>}
                <button className="sa" onClick={() => openMemo(i)}>메모</button>
                <button className="sa" onClick={() => openAi(i)}>AI 요약</button>
                <button className="sa" onClick={() => openWords(i)}>단어</button>
              </div>
            )}
          </div>
        );
      })}

      {resumeIdx > 0 && (
        <button className="fab-resume" onClick={resume}>
          <Icon name="book" size="sm" /> 이어읽기
        </button>
      )}

      {memoIdx !== null && (
        <>
          <div className="scrim show" onClick={() => setMemoIdx(null)} />
          <div className="memo-modal">
            <div className="mm-head"><Icon name="memo" size="sm" /> 메모</div>
            <div className="mm-quote">{parseBlock(body[memoIdx]).text}</div>
            <textarea className="input" rows={4} autoFocus placeholder="이 문단에 대한 메모"
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

      {aiIdx !== null && (
        <>
          <div className="scrim show" onClick={() => setAiIdx(null)} />
          <div className="memo-modal">
            <div className="mm-head"><Icon name="sparkle" size="sm" /> AI 요약</div>
            <div className="mm-quote">{parseBlock(body[aiIdx]).text}</div>
            <div className="ai-result">{aiLoading ? "요약 중…" : aiText}</div>
            <div className="mm-row"><span style={{ flex: 1 }} /><button className="sa on" onClick={() => setAiIdx(null)}>닫기</button></div>
          </div>
        </>
      )}

      {wordIdx !== null && (
        <>
          <div className="scrim show" onClick={() => setWordIdx(null)} />
          <div className="memo-modal">
            <div className="mm-head"><Icon name="book" size="sm" /> 단어 담기</div>
            <div className="mm-quote">{parseBlock(body[wordIdx]).text}</div>
            <div className="word-chips">
              {wordsOf(parseBlock(body[wordIdx]).text).map((w) => (
                <button key={w} className={`wchip${savedWords.has(w) ? " on" : ""}`} onClick={() => saveWord(w, wordIdx)}>
                  {w}{savedWords.has(w) && " ✓"}
                </button>
              ))}
            </div>
            <div className="mm-row"><span style={{ flex: 1 }} /><button className="sa on" onClick={() => setWordIdx(null)}>닫기</button></div>
          </div>
        </>
      )}
    </div>
  );
}
