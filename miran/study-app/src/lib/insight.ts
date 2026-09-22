// 공유 글 "핵심 인사이트" 구조화 회고. 자유 메모를 대체한다(링크·직접작성 공통).
export interface Insight {
  core: string; // 1. 핵심 인사이트 (필수)
  quote: string; // 인상적인 문장
  interpretation: string; // 인사이트 해석
  apply: string; // 2. 내가 바로 적용할 수 있는 것
  similar: string; // 3. 비슷한 사례
  questions: string[]; // 4. 질문 리스트(팀원과 나눌 질문)
  /**
   * core·apply 를 쓸 때 **화면에 떴던 질문 전문.**
   *
   * 답만 저장하면 나중에 읽는 사람이 "이게 무슨 질문에 대한 답이지?" 가 된다.
   * 예전엔 해석 칸에 "질문\n→ 답" 을 이어붙여 넣었는데, 그러면 카드 미리보기에서
   * 줄이 잘려 질문이 반토막 났다. 질문은 **자기 자리**에 따로 둔다.
   * 옛 데이터엔 없으므로 optional 이다.
   */
  coreQ?: string;
  applyQ?: string;
  /**
   * 3. **왜 그 방법이면 풀린다고 봤을까** — 남이 세운 가설의 근거를 추론한 답.
   *
   * 앞의 둘(우리라면 / 어디에 적용)은 *우리* 이야기다. 이 칸만 **글 쓴 쪽의 추론**을 되짚는다.
   * ⚠️ 원인을 묻는 칸이 아니다 — 원인은 글에 적혀 있다. 글에 없는 건 원인과 해법 사이의
   * 연결이고, 그 연결을 추론하는 연습이 자기 가설을 세우는 힘이 된다.
   * 셋 중 가장 품이 드는 질문이라 **맨 뒤**에 둔다 — 중간에 그만두어도 앞 둘은 남는다.
   */
  hypothesis?: string;
  hypothesisQ?: string;
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
    coreQ: typeof r.coreQ === "string" ? r.coreQ : undefined,
    applyQ: typeof r.applyQ === "string" ? r.applyQ : undefined,
    hypothesis: typeof r.hypothesis === "string" ? r.hypothesis : undefined,
    hypothesisQ: typeof r.hypothesisQ === "string" ? r.hypothesisQ : undefined,
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
    // 답이 없으면 질문도 저장하지 않는다 — 질문만 남은 껍데기를 만들지 않는다.
    coreQ: core ? i.coreQ?.trim() || undefined : undefined,
    applyQ: i.apply.trim() ? i.applyQ?.trim() || undefined : undefined,
    hypothesis: i.hypothesis?.trim() || undefined,
    hypothesisQ: i.hypothesis?.trim() ? i.hypothesisQ?.trim() || undefined : undefined,
  };
}

/** 실제로 표시할 인사이트가 있는지(core 존재). */
export function hasInsight(raw: unknown): boolean {
  return toInsight(raw).core.trim().length > 0;
}
