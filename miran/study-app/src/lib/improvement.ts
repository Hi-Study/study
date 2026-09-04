// "무엇을 개선한 사례인가" — 글을 묶어 보는 축.
//
// 왜 이게 필요한가:
//   기존 주제 분류(개발·프로덕트·디자인…)는 **누가 쓴 글이냐**를 말한다.
//   기획자·디자이너·마케터가 실제로 찾는 건 "어떤 문제를 어떻게 풀었나"라서
//   "UI/UX를 개선한 사례", "장애 대응을 개선한 사례"처럼 묶여야 고를 수 있다.
//
// 왜 LLM 을 안 쓰나:
//   이미 enrich 가 뽑아둔 결정 카드(문제·선택·결과) 텍스트가 재료라서
//   **키워드 계산으로 충분하다.** 그래서 (1) 토큰 한도와 무관하게 즉시 적용되고
//   (2) 규칙을 고치면 재분석 없이 바로 반영되고 (3) 공짜다.
//
// ⚠️ 신호가 하나도 없으면 **null 을 돌려준다.** 억지로 아무 태그나 붙이면
//    태그가 정보가 아니라 소음이 된다(난이도 배지가 85% 한 칸에 몰려 실패했던 이유).
import { toDecision } from "@/lib/decision";
import { instrumentalParticle, objectParticle } from "@/lib/josa";

export type ImprovementType =
  | "ux"
  | "perf"
  | "cost"
  | "reliability"
  | "devex"
  | "data"
  | "org"
  | "brand";

/** 분류 키워드. 실측 제목·결정 카드에서 뽑았고, 새 사례가 나오면 여기만 늘리면 된다. */
const KEYWORDS: Record<ImprovementType, string[]> = {
  ux: [
    "ux", "ui", "사용자 경험", "사용성", "인터페이스", "화면", "디자인 시스템",
    "접근성", "온보딩", "인터랙션", "레이아웃", "컴포넌트", "반응형", "웹뷰",
    "사용자가", "이탈률", "전환율", "클릭",
  ],
  perf: [
    "성능", "속도", "지연", "레이턴시", "latency", "응답 시간", "응답시간",
    "최적화", "캐시", "처리량", "throughput", "tps", "qps", "렌더링", "로딩",
    "병목", "cpu", "메모리", "느리", "빨라", "단축",
  ],
  cost: ["비용", "요금", "절감", "예산", "단가", "리소스 절약", "과금", "저렴"],
  reliability: [
    "장애", "에러", "오류", "안정성", "복구", "재시도", "모니터링", "알림",
    "가용성", "무중단", "롤백", "타임아웃", "다운타임", "sla", "헬스체크", "새벽",
  ],
  devex: [
    "개발 생산성", "빌드", "테스트", "ci", "cd", "배포", "리팩터링", "리팩토링",
    "모노리포", "폴리리포", "리포", "개발 환경", "자동화", "코드 리뷰", "린트",
    "마이그레이션", "의존성", "파이프라인 구축", "로컬 환경",
  ],
  // ⚠️ "데이터"·"쿼리"·"로그" 같은 **도메인 명사**는 뺐다. 어느 글에나 나와서
  //    "쿼리 응답 속도가 느림"(= 성능 개선)까지 데이터로 끌어갔다(실측).
  //    이 축은 "무엇이 나아졌나"를 봐야 하므로 지표·실험 쪽 신호만 남긴다.
  data: [
    "지표", "분석", "실험", "a/b", "ab 테스트", "대시보드", "추천",
    "모델", "머신러닝", "ml", "llm", "ai", "집계",
  ],
  org: [
    "조직", "팀", "협업", "프로세스", "문화", "커뮤니케이션", "스쿼드",
    "채용", "회고", "일하는 방식", "직군", "합치", "리더",
  ],
  brand: [
    "브랜드", "마케팅", "캠페인", "리브랜딩", "광고", "홍보", "콘텐츠",
    "고객 경험", "이벤트", "제휴", "오프라인",
  ],
};

/** 유형 이름(내부용·필터 라벨). 화면에 그대로 뿌리지 않는다 — 아래 PHRASE 를 쓴다. */
export const IMPROVEMENT_LABEL: Record<ImprovementType, string> = {
  ux: "UI/UX",
  perf: "성능",
  cost: "비용",
  reliability: "장애 대응",
  devex: "개발 생산성",
  data: "데이터·실험",
  org: "조직·프로세스",
  brand: "브랜드·마케팅",
};

/**
 * 화면에 나가는 **문장 꼬리**.
 *
 * ⚠️ 예전엔 위 LABEL 을 그대로 끼워 넣어 "데이터·실험을 개선한 사례",
 *    "개발 생산성을 개선한 사례" 같은 문장이 나왔다. 분류 이름은 개발자가 만든 말이라
 *    기획자·디자이너가 읽으면 무슨 뜻인지 모른다. 유형마다 **동사까지 맞춘 표현**을 둔다.
 */
const IMPROVEMENT_PHRASE: Record<ImprovementType, string> = {
  ux: "사용자 경험을 개선한 사례",
  perf: "속도를 끌어올린 사례",
  cost: "비용을 줄인 사례",
  reliability: "장애를 줄인 사례",
  devex: "개발 속도를 높인 사례",
  data: "데이터 활용을 개선한 사례",
  org: "일하는 방식을 바꾼 사례",
  brand: "브랜드 경험을 바꾼 사례",
};

/** 점수가 같을 때의 우선순위 — 앞쪽이 이긴다. 흔한 devex 를 뒤로 두어 남발을 막는다. */
const TIE_ORDER: ImprovementType[] = [
  "ux",
  "brand",
  "org",
  "reliability",
  "perf",
  "cost",
  "data",
  "devex",
];

const norm = (v: unknown): string => (typeof v === "string" ? v.toLowerCase() : "");

/** 키워드가 몇 번 등장하는지(부분 일치). */
function score(haystack: string, words: string[]): number {
  let n = 0;
  for (const w of words) if (haystack.includes(w)) n++;
  return n;
}

export interface ImprovementInput {
  decision?: unknown;
  title?: string | null;
  tags?: string[] | null;
}

/**
 * 개선 유형 분류. 신호가 없으면 **null**(태그를 안 붙인다).
 *
 * 결정 카드(문제·선택·결과)를 제목/태그보다 무겁게 본다 — 제목은 비유·말장난이 많아
 * 오분류를 만든다("맛있게 쪼개 먹는 방법"이 요리 글이 아닌 것처럼).
 */
export function classifyImprovement(input: ImprovementInput): ImprovementType | null {
  const d = toDecision(input.decision);
  // 세 단계로 나눠 무게를 준다.
  //   결과(무엇이 나아졌나) > 방법(무엇을 했나) > 제목·태그
  //   방법을 결과만큼 무겁게 보면 "파티셔닝"(방법) 때문에 성능 개선이 데이터로 분류된다.
  const outcome = norm([d.problem, d.metric].join(" "));
  const method = norm([d.chosen, d.constraint].join(" "));
  const weak = norm([input.title ?? "", (input.tags ?? []).join(" ")].join(" "));
  if (!outcome && !method && !weak) return null;

  let best: ImprovementType | null = null;
  let bestScore = 0;
  for (const t of TIE_ORDER) {
    const s =
      score(outcome, KEYWORDS[t]) * 4 +
      score(method, KEYWORDS[t]) * 2 +
      score(weak, KEYWORDS[t]);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  return bestScore > 0 ? best : null;
}

/**
 * 방법이 **부정 서술**이면 문장 앞머리로 못 쓴다.
 *   "리브랜딩 언급 안 함으로 브랜드 경험을 바꾼 사례"  ← 실측(강남언니 글)
 *   "공통 컴포넌트로 만들지 않음으로 사용자 경험을 개선한 사례"
 * 예전 정규식은 `안 하` 만 잡아서 `안 함`·`안함`·`하지 않` 이 그대로 빠져나갔다.
 */
const NEGATED = /않|안\s*하|안\s*함|안함|없이|미사용|미적용|제외|포기/;

/**
 * 카드에 붙일 한 줄.
 *
 * **두 단계로 만든다.** 예전엔 결정 카드의 `chosen`(방법)이 있어야만 문장을 만들어서,
 * 실측 779건 중 **45건에만** 한 줄이 떴다. 나머지는 카드가 텅 비어 "어떤 글은 태그가
 * 있고 어떤 글은 없는" 상태가 됐다. 원인은 LLM 분석(decision)이 70건밖에 안 끝난 것.
 *
 *   ① 방법을 알 때  → "파티셔닝으로 속도를 끌어올린 사례 (3초→0.4초)"
 *   ② 방법을 모를 때 → "속도를 끌어올린 사례"
 *
 * ②는 유형(제목·태그·결정카드 키워드)만으로도 말할 수 있는 **사실**이다. 방법을 지어내지
 * 않는다 — 모르는 건 말하지 않고, 아는 것만 말한다. 분석이 끝나면 저절로 ①로 올라간다.
 * 숫자 결과(`metric`)가 있으면 괄호로 덧붙인다 — 그게 이 서비스의 핵심 가치다.
 */
export function improvementSummary(
  decision: unknown,
  type: ImprovementType | null,
): string | null {
  if (!type) return null;
  const d = toDecision(decision);
  const tail = IMPROVEMENT_PHRASE[type];

  // 방법이 문장이거나 부정 서술이면 앞머리를 붙이지 않는다(실측):
  //   "공통 컴포넌트로 만들지 않음으로 …"
  //   "Claude Agent SDK와 AgentCore Gateway, Runtime, Web Search를 활용한 전환으로 …"
  const usableMethod =
    Boolean(d.chosen) && d.chosen.length <= 20 && !NEGATED.test(d.chosen);

  const head = usableMethod ? `${d.chosen}${instrumentalParticle(d.chosen)} ${tail}` : tail;
  return d.metric ? `${head} (${d.metric})` : head;
}

/**
 * 감상문 질문의 **폴백 사다리.**
 *
 * 원래 질문은 결정 카드의 대조쌍(A 대신 B)이 있어야 만들어졌다. 실측 779건 중 **15건.**
 * 나머지 글은 감상문 화면에 질문이 아예 안 떴다. 재료가 줄어들수록 질문이 넓어지되,
 * **끝까지 답할 수 있는 질문**을 준다 — "인사이트를 적어보세요" 같은 빈 상자는 안 준다.
 */
export function fallbackQuestion(input: ImprovementInput): string {
  const d = toDecision(input.decision);
  // ② 무엇을 골랐는지는 아는데 비교 대상이 없을 때.
  if (d.chosen && d.chosen.length <= 20 && !NEGATED.test(d.chosen)) {
    return `${d.chosen}${objectParticle(d.chosen)} 택한 이유가 우리 상황에도 그대로 해당될까요?`;
  }
  // ③ 개선 유형만 아는 경우 — "무엇을 보고 그렇게 판단했나"를 묻는다.
  const type = classifyImprovement(input);
  if (type) {
    return `${IMPROVEMENT_PHRASE[type].replace(/ 사례$/, "")} 과정에서 이들이 내린 판단 중, 가장 눈에 띈 건 뭐였나요?`;
  }
  // ④ 아무 신호도 없을 때. 넓지만 진짜 답이 나오는 질문.
  return "이 글에서 가장 인상 깊었던 한 가지는 무엇인가요?";
}

/**
 * **접목 질문** — "이 글의 방법을 우리 일에 어떻게 붙일까".
 *
 * 인사이트 질문(위)과 짝을 이룬다. 하나는 *이 글에서 무엇을 봤나*,
 * 하나는 *그래서 우리는 무엇을 하나*. 기획자·디자이너·마케터가 이 앱에서 얻어야 할 건
 * 결국 두 번째다 — 읽고 끝나면 남는 게 없다.
 */
export function applyQuestion(input: ImprovementInput): string {
  const d = toDecision(input.decision);
  const type = classifyImprovement(input);
  if (d.chosen && d.chosen.length <= 20 && !NEGATED.test(d.chosen)) {
    return `${d.chosen}${objectParticle(d.chosen)} 우리 일에 그대로 옮긴다면, 어디부터 손대시겠어요?`;
  }
  if (type) {
    return `${IMPROVEMENT_PHRASE[type].replace(/ 사례$/, "")} 방식을 우리 일에 붙인다면, 어디부터 손대시겠어요?`;
  }
  return "이 글에서 우리 일에 바로 옮겨올 수 있는 건 무엇인가요?";
}
