// 하이라이트 → 인사이트 초안.
//
// 인사이트를 남기려면 빈 칸 6개를 채워야 해서 대부분 거기서 나간다.
// 그래서 진입을 3단 사다리로 만든다:
//   ① 하이라이트를 그었다 → **초안이 채워진 폼**(이 파일)  … 고치기만 하면 됨
//   ② 하이라이트 없음      → 질문 1개(lib/decision.ts)      … 한 문장 답
//   ③ 둘 다 부담          → 원탭 스탬프                      … 탭 한 번
//
// 핵심은 **AI에게 글 전체를 요약시키지 않는다**는 점이다. 이 사람이 직접 밑줄 그은 문장만
// 재료로 쓴다. 그래야 나오는 초안이 "글의 요약"이 아니라 "이 사람이 이 글에서 본 것"이 되고,
// 남의 요약과 달리 고칠 마음이 생긴다. 재료가 짧아 AI 비용도 거의 안 든다.
import { EMPTY_INSIGHT, type Insight } from "@/lib/insight";

/** 초안 재료 — 내가 이 글에 남긴 하이라이트 한 줄. */
export interface DraftHighlight {
  quote: string | null;
  note: string | null;
  sentence_index?: number;
}

export interface InsightDraft {
  /** 폼에 미리 채워 넣을 값(빈 칸은 그대로 빈 문자열). */
  insight: Insight;
  /** 재료로 쓴 하이라이트 개수 — 0 이면 이 경로를 띄우지 않는다. */
  usedCount: number;
  /** core 를 AI 로 채워야 하는지(메모가 하나도 없으면 사람이 쓴 재료가 없다는 뜻). */
  needsAi: boolean;
}

const clean = (v: string | null | undefined): string => (v ?? "").replace(/\s+/g, " ").trim();

/**
 * 하이라이트로 인사이트 초안을 만든다. **순수 함수** — AI 호출 없음.
 *
 * - `quote`         ← 가장 긴 하이라이트 원문(가장 길게 그은 문장 = 가장 중요하게 본 문장)
 * - `interpretation`← 하이라이트에 단 메모들(이미 사람이 쓴 글이라 AI 가 필요 없다)
 * - `core`          ← 메모가 있으면 첫 메모를 씨앗으로. 메모가 없으면 비우고 needsAi=true
 *
 * 하이라이트가 없으면 usedCount=0 으로 돌려준다(호출부가 질문 1개 경로로 넘어간다).
 */
export function draftFromHighlights(highlights: DraftHighlight[]): InsightDraft {
  const rows = (highlights ?? []).filter((h) => clean(h.quote) || clean(h.note));
  if (rows.length === 0) {
    return { insight: { ...EMPTY_INSIGHT }, usedCount: 0, needsAi: false };
  }

  // 가장 길게 그은 문장을 대표 인용으로.
  const quote = rows
    .map((h) => clean(h.quote))
    .filter(Boolean)
    .sort((a, b) => b.length - a.length)[0] ?? "";

  const notes = rows.map((h) => clean(h.note)).filter(Boolean);

  return {
    insight: {
      ...EMPTY_INSIGHT,
      quote,
      // 메모는 이미 내가 쓴 해석이다. 여러 개면 줄바꿈으로 잇는다.
      interpretation: notes.join("\n"),
      core: notes[0] ?? "",
    },
    usedCount: rows.length,
    needsAi: notes.length === 0,
  };
}

/**
 * AI 에 넘길 재료 문자열 — 밑줄 친 문장 + 메모만. 본문은 넣지 않는다.
 * 반환이 빈 문자열이면 보낼 재료가 없다는 뜻(호출하지 않는다).
 */
export function draftPromptSource(highlights: DraftHighlight[]): string {
  return (highlights ?? [])
    .map((h) => {
      const q = clean(h.quote);
      const n = clean(h.note);
      if (q && n) return `- "${q}" (내 메모: ${n})`;
      if (q) return `- "${q}"`;
      if (n) return `- (메모) ${n}`;
      return "";
    })
    .filter(Boolean)
    .join("\n");
}
