// AI 요약 모드 — 공유/토론 공통.
export type SummaryMode = "plain" | "planner" | "explain";

export const SUMMARY_MODES: { key: SummaryMode; label: string; hint: string }[] = [
  { key: "plain", label: "원문 요약", hint: "핵심만 압축" },
  { key: "planner", label: "기획자 관점", hint: "기획자가 볼 포인트" },
  { key: "explain", label: "쉽게 풀기", hint: "쉬운 말로" },
];

export type SummaryMap = Partial<Record<SummaryMode, string>>;
