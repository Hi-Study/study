/**
 * 제목 문장 — 목록 카드와 글 상세 맨 위에 똑같이 쓰는 한 문장(learning.cardHeadline). 상세 분석 단계에서 만든다.
 * 2026-11-16 통일: 예전엔 목록은 분류 단계의 cardHeadline(핵심 문장), 상세는 분석 단계의 hook(미끼 문장)이라 서로 달랐다.
 * 2026-11-17: 예전 상세 제목(hook) 방식으로 되돌렸다 — 미끼 문장 · 결론 스포일러 금지. 길이·말투·낚시 규칙은 풀고
 *   코드 검사는 영어·개발 용어만 본다. 걸리면 한 번 다시 쓰게 하고, 그래도 걸리면 버린다 → 화면은 원제목을 보여 준다.
 * 기준 문서: docs/01_분류기준.md 2단계 "제목 문장"
 */
import { json, obj, str } from "../shared/ai";
import { jargonProblem } from "../shared/plain-text";

/** 몇 번째 기준으로 만든 제목인지 — 백필이 이어서 돌 때 이미 한 글을 건너뛴다. 3 = 예전 상세 제목(hook) 방식 */
export const HEADLINE_VERSION = 3;

/** 상세 분석 프롬프트와 다시 쓰기 프롬프트가 같이 쓰는 규칙 */
export const HEADLINE_RULE = `cardHeadline — 목록 카드와 글 상세 맨 위에 똑같이 들어가는 제목 문장. 클릭하고 싶어지는 미끼 문장. 결론을 스포일러하지 마라.
  영어 단어·개발 용어는 쓰지 말고 쉬운 우리말로 풀어 쓴다(파이프라인, 아키텍처, 렌더링, 캐시, LLM, API, QA … 금지). "AI" 는 써도 된다.`;

/** 제목 문장 규칙 — 비어 있지 않고, 영어·개발 용어가 없을 것. 통과하면 null, 아니면 이유 */
export function headlineProblem(h: string): string | null {
  if (!(h ?? "").trim()) return "비어 있음";
  return jargonProblem(h);
}

/**
 * 첫 답(first)을 검사하고, 걸리면 그 칸만 한 번 다시 쓰게 한다. first 가 없으면 처음부터 쓴다(백필).
 * 통과한 문장, 두 번 다 걸리면 null(→ 화면은 원제목).
 */
export async function settleHeadline(
  title: string,
  text: string,
  first: string | undefined,
  log: (m: string) => void = () => {},
): Promise<string | null> {
  const sys = `너는 국내 테크 블로그 글을 기획자·디자이너·마케터에게 소개하는 편집자다. 한국어 존댓말(~해요). JSON 하나만 출력한다.\n${HEADLINE_RULE}`;
  const input = `제목: ${title}\n\n원문:\n${text}`;
  const ask = async (feedback: string) =>
    (await json<{ cardHeadline: string }>(sys, input + feedback, obj({ cardHeadline: str(8) }), 300)).cardHeadline ?? "";

  let h = first ?? (await ask(""));
  let problem = headlineProblem(h);
  if (problem) {
    log(`    · 제목 문장 규칙 위반(${problem}): ${h}`);
    h = await ask(`\n\n[지난 cardHeadline "${h}" 이 규칙에 걸렸다: ${problem}. 규칙대로 다시 써라.]`);
    problem = headlineProblem(h);
    if (problem) log(`    · 다시 쓴 제목도 위반(${problem}): ${h} → 원제목을 보여 줘요`);
  }
  return problem ? null : h.trim();
}
