/**
 * 제목 문장 — 목록 카드와 글 상세 맨 위에 똑같이 쓰는 한 문장(learning.cardHeadline). 상세 분석 단계에서 만든다.
 * 2026-11-16 통일: 예전엔 목록은 분류 단계의 cardHeadline(핵심 문장), 상세는 분석 단계의 hook(미끼 문장)이라 서로 달랐다.
 * 코드 검사에 걸리면 한 번 다시 쓰게 하고, 그래도 걸리면 버린다 → 화면은 원제목을 보여 준다.
 * 기준 문서: docs/01_분류기준.md 2단계 "제목 문장"
 */
import { json, obj, str } from "../shared/ai";
import { plainTextProblem } from "../shared/plain-text";

/** 몇 번째 기준으로 만든 제목인지 — 백필이 이어서 돌 때 이미 한 글을 건너뛴다 */
export const HEADLINE_VERSION = 2;

/** 상세 분석 프롬프트와 다시 쓰기 프롬프트가 같이 쓰는 규칙 */
export const HEADLINE_RULE = `cardHeadline — 목록 카드와 글 상세 맨 위에 똑같이 들어가는 **제목 문장 하나**.
  개발을 전혀 모르는 사람이 읽자마자 무슨 이야기인지 알아야 한다.
  · 클릭하고 싶어지게 쓰되 **결론을 스포일러하지 마라** — 어떻게 풀었는지·얼마나 좋아졌는지는 말하지 않는다.
    누가 어떤 곤란을 겪었는지, 무엇을 바꾸려 했는지까지만 말해서 "그래서 어떻게 됐지?"가 궁금해지게.
  · 8~40자, "~요"로 끝낸다(질문형 "~을까요?"도 된다).
  · 개발 용어·영어 기술 이름을 쓰지 마라(파이프라인, 아키텍처, 비동기, 렌더링, 캐시, 큐, LLM, API …). "AI" 는 써도 된다.
  · 낚시·과장 금지 — 원문에 없는 약속, "~의 비밀/비결", "충격", "놀라운", "완벽한" 같은 말을 쓰지 마라. 숫자는 원문에 있는 것만.
  · 좋은 예: "사장님 입점 승인은 왜 며칠씩 걸렸을까요?" · "개발자가 장애 원인을 찾느라 로그를 뒤지고 있었어요"
  · 나쁜 예: "주문 취소, 이제 앱에서 버튼 한 번이면 돼요"(결론을 다 말함) · "비동기 큐로 로그 지연을 해결한 방법"(개발 용어)
    · "LLM 대화형 BI의 치명적 벽을 넘은 비결은?"(영어·낚시)`;

/** 낚시·과장 표현 — 프롬프트로 막고, 그래도 쓰면 코드가 걸러 낸다 */
const BAIT = /비밀|비결|충격|놀라운|놀랍|역대급|완벽|무조건|대박|경악|소름|이것만|단 하나/;

/** 제목 문장 규칙. 통과하면 null, 아니면 이유 */
export function headlineProblem(h: string, sourceText: string): string | null {
  const p = plainTextProblem(h, sourceText, 8, 40);
  if (p) return p;
  const b = (h ?? "").match(BAIT);
  return b ? `낚시·과장 표현: ${b[0]}` : null;
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
  let problem = headlineProblem(h, text);
  if (problem) {
    log(`    · 제목 문장 규칙 위반(${problem}): ${h}`);
    h = await ask(`\n\n[지난 cardHeadline "${h}" 이 규칙에 걸렸다: ${problem}. 규칙대로 다시 써라.]`);
    problem = headlineProblem(h, text);
    if (problem) log(`    · 다시 쓴 제목도 위반(${problem}): ${h} → 원제목을 보여 줘요`);
  }
  return problem ? null : h.trim();
}
