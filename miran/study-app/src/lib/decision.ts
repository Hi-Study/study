// 결정 카드 — "어떤 테크를 썼나"가 아니라 "어떤 문제를 어떻게 풀었나".
//   기획자/디자이너/마케터가 실제로 검색하는 축(문제·트레이드오프·결과 지표)으로 글을 다시 쓴다.
//   수집 시 AI 배치가 articles.decision 에 채우고, 본문에 트레이드오프 서술이 없으면 null 로 둔다.
//   ⚠️ 억지로 만들지 않는다 — 없는 글은 화면에서 카드를 통째로 숨기고 스탬프만 보여준다.
import type { ArticleDecision } from "@/types/database";

export const EMPTY_DECISION: ArticleDecision = {
  problem: "",
  constraint: "",
  chosen: "",
  rejected: "",
  metric: "",
};

/** DB(jsonb)나 unknown 값을 ArticleDecision 으로 안전 변환(누락 필드는 빈 문자열). */
export function toDecision(raw: unknown): ArticleDecision {
  if (!raw || typeof raw !== "object") return { ...EMPTY_DECISION };
  const r = raw as Partial<ArticleDecision>;
  const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
  return {
    problem: str(r.problem),
    constraint: str(r.constraint),
    chosen: str(r.chosen),
    rejected: str(r.rejected),
    metric: str(r.metric),
  };
}

/**
 * 카드를 띄울 만한지 — 최소한 "무슨 문제"와 "어떻게 했나"가 있어야 한다.
 * 둘 중 하나라도 비면 반쪽짜리 카드라 안 보여주는 게 낫다.
 */
export function hasDecision(raw: unknown): boolean {
  const d = toDecision(raw);
  return d.problem.length > 0 && d.chosen.length > 0;
}

/**
 * 두 선택지가 **비교 가능한 대안 한 쌍**인지 본다.
 *
 * 실측 실패 사례(2026-09-02 enrich 검수):
 *   "공통 컴포넌트화 대신 공통 컴포넌트로 만들지 않음을 골랐을까요?"
 *   — 같은 대상을 긍정/부정으로 적은 것이라 질문이 성립하지 않는다.
 * 엣지 함수(summarize)의 comparablePair 와 **같은 규칙**이다. 한쪽만 고치지 말 것.
 */
/** 받침이 있으면 true. 한글이 아닌 끝(영문·숫자)은 false 로 본다. */
function hasFinalConsonant(word: string): boolean {
  const ch = word.trim().slice(-1);
  const code = ch.charCodeAt(0);
  if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

/**
 * 주격 조사 — 받침이 있으면 "은", 없으면 "는".
 * "올리브영는 왜…", "당근는 왜…" 처럼 틀리던 것을 고친다(실측).
 */
export function subjectParticle(word: string): "은" | "는" {
  return hasFinalConsonant(word) ? "은" : "는";
}

/**
 * 목적격 조사 — 받침이 있으면 "을", 없으면 "를".
 * 이걸 안 하면 "과거 장애 패턴 대조을 골랐을까요?" 처럼 어색해진다(실측).
 * 한글이 아닌 끝(영문·숫자)은 관용을 따라 "를".
 */
export function objectParticle(word: string): "을" | "를" {
  return hasFinalConsonant(word) ? "을" : "를";
}

export function comparablePair(chosen: string, rejected: string): boolean {
  if (!chosen || !rejected) return false;
  if (chosen.length > 20 || rejected.length > 20) return false; // 문장이면 탈락
  if (/(선택|도입|적용|채택|사용|변경|전환)$/.test(chosen.trim()) || /(선택|도입|적용|채택|사용|변경|전환)$/.test(rejected.trim())) return false; // 서술형 꼬리

  if (/않|안 하|없이|미사용|제외/.test(chosen + rejected)) return false; // 부정 서술
  const norm = (v: string) => v.replace(/[\s·]/g, "");
  const a = norm(chosen);
  const b = norm(rejected);
  if (a.includes(b) || b.includes(a)) return false; // 한쪽이 다른 쪽을 포함
  return a.slice(0, 5) !== b.slice(0, 5); // 앞부분이 같으면 같은 대상
}

/**
 * 인사이트 유도 질문 1개 — **AI에게 자유 생성시키지 않는다.**
 * 자유 생성은 "이 글의 핵심은?" 같은 어느 글에나 붙는 질문을 낳는다.
 * 좋은 질문은 글 안에 실제로 있는 두 선택지를 이름으로 부른다. 그래서 결정 카드의
 * `chosen`/`rejected` 가 **둘 다 있을 때만** 조립하고, 없으면 null 을 돌려준다.
 *
 * @param blogName 출처 기업명(있으면 "토스는 왜…" 로 주어를 붙인다)
 */
export function questionFromDecision(
  raw: unknown,
  blogName?: string | null,
): string | null {
  const d = toDecision(raw);
  if (!comparablePair(d.chosen, d.rejected)) return null;

  const name = blogName?.trim() ?? "";
  const subject = name ? `${name}${subjectParticle(name)} 왜 ` : "왜 ";
  return `${subject}${d.rejected} 대신 ${d.chosen}${objectParticle(d.chosen)} 골랐을까요?`;
}

/**
 * 저장된 질문이 쓸 만한지 검증 — 결정 카드의 두 선택지가 문장에 살아 있어야 통과.
 * AI 가 만든 질문을 그대로 믿지 않고 이 게이트를 통과한 것만 화면에 띄운다.
 */
export function isUsableQuestion(question: string | null | undefined, raw: unknown): boolean {
  const q = (question ?? "").trim();
  if (q.length < 8) return false;
  const d = toDecision(raw);
  if (!comparablePair(d.chosen, d.rejected)) return false;
  return q.includes(d.chosen) && q.includes(d.rejected);
}

/** 결정 카드에서 화면에 뿌릴 항목들(값이 있는 것만, 표시 순서대로). */
export function decisionRows(raw: unknown): { label: string; value: string }[] {
  const d = toDecision(raw);
  return [
    { label: "무슨 문제", value: d.problem },
    { label: "어떤 제약", value: d.constraint },
    { label: "선택한 방법", value: d.chosen },
    { label: "버린 대안", value: d.rejected },
    { label: "결과", value: d.metric },
  ].filter((r) => r.value.length > 0);
}
