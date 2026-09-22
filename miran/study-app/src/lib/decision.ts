// 결정 카드 — "어떤 테크를 썼나"가 아니라 "어떤 문제를 어떻게 풀었나".
//   기획자/디자이너/마케터가 실제로 검색하는 축(문제·트레이드오프·결과 지표)으로 글을 다시 쓴다.
//   수집 시 AI 배치가 articles.decision 에 채우고, 본문에 트레이드오프 서술이 없으면 null 로 둔다.
//   ⚠️ 억지로 만들지 않는다 — 없는 글은 화면에서 카드를 통째로 숨기고 스탬프만 보여준다.
import type { ArticleDecision } from "@/types/database";
import { instrumentalParticle, objectParticle, subjectParticle } from "@/lib/josa";

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
/**
 * 문장으로 끼워 넣어도 되는 짧은 명사구인지. 길거나 부정 서술이면 질문이 망가진다.
 *
 * ⚠️ **조사를 이미 달고 있는 서술구**도 막는다. "MRAID 표준을 선택" 을 그대로 끼우면
 *    "MRAID 표준을 선택을 골랐을까요?" 가 된다(실측). "CI 기반 본인인증 도입" 처럼
 *    조사 없는 명사구는 통과시킨다 — 그건 문장에 자연스럽게 들어간다.
 */
function usablePhrase(v: string, max = 24): boolean {
  const t = v.trim();
  if (t.length === 0 || t.length > max) return false;
  if (/않|안 하|안 함|없이|미사용|제외/.test(t)) return false;
  return !/(을|를|이|가|은|는)\s*(선택|도입|적용|채택|사용|변경|전환)$/.test(t);
}

/**
 * 문장을 질문 앞머리로 쓸 수 있게 다듬는다 — **마침표만 뗀다.**
 *
 * ⚠️ 종결어미(함·음·임)까지 떼어 봤다가 되돌렸다. "제공하고 싶음" → "제공하고 싶" 이
 *    되어 말이 잘렸다(실측). 어미를 건드리는 대신 **줄표(—)로 끊어** 뒤 문장과 잇는다.
 *    조사를 억지로 붙이면("…부족라는") 더 어색해진다.
 */
function asClause(v: string): string {
  return v.trim().replace(/[.。]$/, "").trim();
}

/**
 * **이 숫자가 고른 것의 성과인가.**
 *
 * 실측 사고: PolicyGuard 글에서 `chosen="PolicyGuard 프레임워크"`,
 * `metric="Presidio Effective Block Rate 62.2%"` 가 잡혔다. 그런데 62.2% 는 PolicyGuard 의
 * 성과가 아니라 **비교 대상(Presidio)의 한계**를 보여주는 숫자다
 * (본문: "Presidio 의 EBR 은 62.2% 에 그쳤으며 … 약 38% 가 탐지되지 않고 통과됨").
 * 그걸 "PolicyGuard 를 골랐더니 62.2%" 로 이어 붙이니 **사실이 뒤집힌 질문**이 나왔다.
 *
 * 그래서 metric 이 **고른 것과 다른 이름으로 시작하면** 남의 숫자로 보고 쓰지 않는다.
 * 지표 이름(응답 시간, 실패율)은 일반명사로 시작하므로 걸리지 않는다.
 */
export function metricBelongsToChoice(chosen: string, metric: string): boolean {
  const m = metric.trim();
  if (!m) return false;
  const first = m.split(/[\s·,(]/)[0] ?? "";
  // ⚠ **전부 대문자인 약어는 제품명이 아니다.** 처음엔 `^[A-Z]` 로만 보고 걸렀는데,
  //   그러면 `CPU 86.6% 감소` `RPS 100→4,000` `LLM 비용 64% 절감` `JSON 파싱 실패율 0건`
  //   같은 **멀짱한 지표까지 전부 버려졌다**(실측 5건 중 4건이 오탐).
  //   제품명은 `Presidio` `PolicyGuard` 처럼 **첫 글자만 대문자**다.
  const looksLikeName = /^[A-Z][a-z][A-Za-z0-9.-]*$/.test(first);
  if (!looksLikeName) return true;
  const norm = (v: string) => v.toLowerCase().replace(/[\s·-]/g, "");
  return norm(chosen).includes(norm(first));
}

/**
 * 결정 카드로 **인사이트 질문**을 조립한다.
 *
 * ⚠️ 예전엔 대조쌍(A 대신 B)이 있어야만 질문을 만들었다. 그래서 결정 카드가 있는
 *    70건 중 **15건**에만 질문이 붙었다. 그런데 카드에는 rejected 말고도
 *    problem(70) · constraint(63) · metric(19) 이 들어 있다 — 재료가 있는데
 *    한 가지 형태만 고집해서 나머지를 버린 것이다.
 *    아래로 갈수록 재료가 적어지지만, **있는 재료로 만들 수 있는 가장 구체적인 질문**을 만든다.
 */
export function questionFromDecision(
  raw: unknown,
  blogName?: string | null,
): string | null {
  const d = toDecision(raw);
  const name = blogName?.trim() ?? "";
  const who = name ? `${name}${subjectParticle(name)} ` : "";

  // ① 버린 대안이 온전하면 트레이드오프를 정면으로 묻는다 — 가장 좋은 질문이다.
  if (comparablePair(d.chosen, d.rejected)) {
    return `${who}왜 ${d.rejected} 대신 ${d.chosen}${objectParticle(d.chosen)} 골랐을까요?`;
  }
  // ② 제약이 있으면 "그 조건이 없었다면?" 이 판단의 이유를 끌어낸다.
  if (usablePhrase(d.chosen) && usablePhrase(d.constraint, 40)) {
    return `${asClause(d.constraint)} — 이 조건이 없었다면 ${who}${d.chosen}${objectParticle(d.chosen)} 그대로 골랐을까요?`;
  }
  // ③ 문제와 해법만 있어도 "우리라면?" 을 물을 수 있다.
  if (usablePhrase(d.chosen) && usablePhrase(d.problem, 40)) {
    return `${asClause(d.problem)} — 이 문제를 ${d.chosen}${instrumentalParticle(d.chosen)} 풀었는데, 우리라면 같은 선택을 할까요?`;
  }
  // ④ 숫자 결과만 남았을 때 — 그 숫자가 나온 이유를 묻는다.
  //    ⚠️ "골랐더니 ~" 는 인과를 단정하는 문장이다. 그 숫자가 **고른 것의 성과일 때만** 쓴다.
  if (
    usablePhrase(d.metric, 40) &&
    usablePhrase(d.chosen) &&
    metricBelongsToChoice(d.chosen, d.metric)
  ) {
    return `${d.chosen}${objectParticle(d.chosen)} 골랐더니 ${asClause(d.metric)} — 무엇이 이 차이를 만들었을까요?`;
  }
  return null;
}

/**
 * 결정 카드로 **접목 질문**을 조립한다("그래서 우리 일엔 어떻게").
 * 여기도 재료가 있는 만큼 구체적으로 묻는다. 없으면 null 이고 호출부가 유형 템플릿으로 내려간다.
 */
export function applyQuestionFromDecision(raw: unknown): string | null {
  const d = toDecision(raw);
  // 숫자 결과가 있으면 "우리는 무엇으로 잴까"가 가장 실행에 가깝다.
  // 남의 숫자면 쓰지 않는다(위 metricBelongsToChoice 주석 참고).
  if (usablePhrase(d.metric, 40) && metricBelongsToChoice(d.chosen, d.metric)) {
    return `${asClause(d.metric)} — 우리 일에서는 무엇으로 이 변화를 재 볼 수 있을까요?`;
  }
  if (usablePhrase(d.chosen)) {
    return `${d.chosen}${objectParticle(d.chosen)} 우리 일에 그대로 옮긴다면, 어디부터 손대시겠어요?`;
  }
  if (usablePhrase(d.problem, 40)) {
    return `${asClause(d.problem)} — 우리에게도 같은 문제가 있나요? 있다면 어디에서 드러나나요?`;
  }
  return null;
}

/**
 * 결정 카드로 **가설 질문**을 조립한다("왜 그 방법이면 풀린다고 봤을까").
 *
 * ⚠️ **원인을 묻지 않는다.** 원인은 글이 이미 말해 준다("결제 실패가 반복됐다") —
 *    그걸 되물으면 답이 본문 베끼기가 된다. 글에 없는 건 그 다음 칸이다:
 *    원인과 해법 **사이의 연결**, 즉 "그 방법이면 이 원인이 해소된다"고 본 근거.
 *    그 연결을 추론해 보는 연습이 쌓여야 자기 가설을 세울 수 있다.
 *
 * 재료가 없으면 null — 호출부가 lib/improvement 의 템플릿으로 내려간다.
 */
export function hypothesisQuestionFromDecision(
  raw: unknown,
  blogName?: string | null,
): string | null {
  const d = toDecision(raw);
  const name = blogName?.trim() ?? "";
  const who = name ? `${name}${subjectParticle(name)} ` : "";

  // ① 문제와 해법이 함께 있으면 **둘 사이의 연결**을 묻는다 — 가장 좋은 재료다.
  if (usablePhrase(d.chosen) && usablePhrase(d.problem, 40)) {
    return `${asClause(d.problem)} — ${who}왜 ${d.chosen}${instrumentalParticle(d.chosen)} 이게 풀린다고 봤을까요?`;
  }
  // ② 버린 대안이 있으면 "왜 저건 안 되고 이건 된다고 봤나"로 같은 걸 묻는다.
  if (comparablePair(d.chosen, d.rejected)) {
    return `${who}왜 ${d.rejected}${instrumentalParticle(d.rejected)}는 안 되고 ${d.chosen}${instrumentalParticle(d.chosen)} 풀린다고 봤을까요?`;
  }
  // ③ 제약만 있을 때 — 그 조건 아래에서 통할 거라고 본 근거.
  if (usablePhrase(d.chosen) && usablePhrase(d.constraint, 40)) {
    return `${asClause(d.constraint)} — 그런데도 ${d.chosen}${objectParticle(d.chosen)} 고르면 풀린다고 본 근거는 뭐였을까요?`;
  }
  // ④ 자기 숫자만 남았을 때 — 해보기 전에 이만큼 달라질 거라고 본 근거.
  if (
    usablePhrase(d.metric, 40) &&
    usablePhrase(d.chosen) &&
    metricBelongsToChoice(d.chosen, d.metric)
  ) {
    return `${asClause(d.metric)} — 해보기 전에 이만큼 달라질 거라고 본 근거는 뭐였을까요?`;
  }
  return null;
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
