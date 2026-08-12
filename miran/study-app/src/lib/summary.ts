// AI 요약 모드 — 공유/토론 공통 + distill 아티클 3관점(insight).
export type SummaryMode = "plain" | "planner" | "explain" | "insight";

export const SUMMARY_MODES: { key: SummaryMode; label: string; hint: string }[] = [
  { key: "plain", label: "원문 요약", hint: "핵심만 압축" },
  { key: "planner", label: "기획자 관점", hint: "기획자가 볼 포인트" },
  { key: "explain", label: "쉽게 풀기", hint: "쉬운 말로" },
];

export type SummaryMap = Partial<Record<SummaryMode, string>>;

// distill 글 상세 "AI 요약 3관점" — 무슨 문제 / 어떻게 해결 / 기획 관점 배울 점.
export interface InsightSection {
  title: string;
  body: string;
}

/**
 * insight 요약 텍스트를 '### 제목' 기준으로 3개 섹션으로 쪼갠다.
 * 마커가 없으면(구형/실패) 통째로 한 섹션으로 반환. 순수 — 테스트 대상.
 */
export function splitInsightSections(text: string): InsightSection[] {
  const t = (text ?? "").trim();
  if (!t) return [];
  if (!t.includes("###")) return [{ title: "AI 요약", body: t }];
  return t
    .split(/^###\s+/m)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((p) => {
      const nl = p.indexOf("\n");
      return nl === -1
        ? { title: p.trim(), body: "" }
        : { title: p.slice(0, nl).trim(), body: p.slice(nl + 1).trim() };
    });
}
