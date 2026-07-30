// 공유 글 "핵심 인사이트" 구조화 회고. 자유 메모를 대체한다(링크·직접작성 공통).
export interface Insight {
  core: string; // 1. 핵심 인사이트 (필수)
  quote: string; // 인상적인 문장
  interpretation: string; // 인사이트 해석
  apply: string; // 2. 내가 바로 적용할 수 있는 것
  similar: string; // 3. 비슷한 사례
  questions: string[]; // 4. 질문 리스트(팀원과 나눌 질문)
}

export const EMPTY_INSIGHT: Insight = {
  core: "",
  quote: "",
  interpretation: "",
  apply: "",
  similar: "",
  questions: [],
};

/** DB(jsonb)나 unknown 값을 Insight 로 안전 변환(누락 필드는 빈 값). */
export function toInsight(raw: unknown): Insight {
  if (!raw || typeof raw !== "object") return { ...EMPTY_INSIGHT };
  const r = raw as Partial<Insight>;
  return {
    core: typeof r.core === "string" ? r.core : "",
    quote: typeof r.quote === "string" ? r.quote : "",
    interpretation: typeof r.interpretation === "string" ? r.interpretation : "",
    apply: typeof r.apply === "string" ? r.apply : "",
    similar: typeof r.similar === "string" ? r.similar : "",
    questions: Array.isArray(r.questions) ? r.questions.filter((q): q is string => typeof q === "string") : [],
  };
}

/** 저장용 정규화 — 앞뒤 공백/빈 질문 제거. 핵심 인사이트(core)가 비면 null(저장 안 함). */
export function cleanInsight(i: Insight): Insight | null {
  const core = i.core.trim();
  if (!core) return null;
  return {
    core,
    quote: i.quote.trim(),
    interpretation: i.interpretation.trim(),
    apply: i.apply.trim(),
    similar: i.similar.trim(),
    questions: i.questions.map((q) => q.trim()).filter(Boolean),
  };
}

/** 실제로 표시할 인사이트가 있는지(core 존재). */
export function hasInsight(raw: unknown): boolean {
  return toInsight(raw).core.trim().length > 0;
}
