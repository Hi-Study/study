// 결정 카드 — "어떤 테크를 썼나"가 아니라 "어떤 문제를 어떻게 풀었나".
//   기획자/디자이너/마케터가 실제로 검색하는 축(문제·트레이드오프·결과 지표)으로 글을 다시 쓴다.
//   수집 시 AI 배치가 articles.decision 에 채우고, 본문에 트레이드오프 서술이 없으면 null 로 둔다.
//   ⚠️ 억지로 만들지 않는다 — 없는 글은 화면에서 카드를 통째로 숨기고 스탬프만 보여준다.
import type { ArticleDecision } from "@/types/database";
import { objectParticle, subjectParticle } from "@/lib/josa";

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
// 조사 규칙은 lib/josa.ts 로 모았다(질문 · 개선 한 줄 요약이 같이 쓴다).
// 기존 호출부·테스트를 위해 여기서 그대로 재수출한다.
export { subjectParticle, objectParticle } from "@/lib/josa";

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
/**
 * DB 에 저장된 질문을 **그대로 써도 되는지** 본다.
 *
 * 예전 규칙은 "대조쌍으로 조립된 질문"만 통과시켰다. 그래서 LLM 이 잘 쓴 질문도
 * 전부 버려지고 779건 중 15건만 남았다. 이제 enrich 가 게이트를 통과한 질문만
 * 저장하므로, 앱은 **일반론만 걸러내면** 된다(서버와 같은 금지어·길이 기준).
 *
 * ⚠️ 여기서 통과 못 해도 화면에 질문은 뜬다 — lib/improvement 의 템플릿으로 내려간다.
 */
const GENERIC_QUESTION =
  /이 글|본문|저자|필자|핵심은|인상 ?깊|무엇을 배웠|어떤 점이|느낀 점|소감|정리해 ?보|요약해/;

export function isUsableQuestion(question: string | null | undefined): boolean {
  const q = (question ?? "").trim();
  if (q.length < 15 || q.length > 90) return false;
  if (!q.endsWith("?")) return false;
  return !GENERIC_QUESTION.test(q);
}

/** 결정 카드에서 화면에 뿌릴 항목들(값이 있는 것만, 표시 순서대로). */
// ⚠️ decisionRows(결정 카드 표 만들기)는 삭제했다. 카드 자체를 화면에서 뺐다 —
//    결과 수치는 제목 아래 한 줄이 괄호로 말하고, 문제·제약은 AI 요약과 겹쳤다.
//    decision 은 계속 쓴다: **한 줄 태그(improvement.ts)와 감상문 질문**의 재료다.
