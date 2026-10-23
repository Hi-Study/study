/**
 * 1단계(배제 판정) · 상세 분석 · 글 상세 요약·개념 · 2단계("더 들어가 볼까요?" 칸 만들기) 프롬프트.
 * 기준 문서: docs/01_분류기준.md 1~2단계, docs/참고/더-들어가-볼까요-기준.md
 */
import { Type, type Schema } from "@google/genai";
import { DETAIL_MODEL, json, obj, str, strArr } from "../shared/ai";
import { splitBlocks, type Block } from "../0-collect/content";
import type { Concept, Learning, Overview, ReadingGuide } from "../shared/types";
import { gateGuide, numbersIn, sentences } from "./guide-gate";

/* ───────────── 1차 게이트 (저비용) ───────────── */

const GATE_SYS = `너는 기술 블로그 큐레이터다. 이 글이 기획자·PM·디자이너에게 읽을 가치가 있는지 판단한다.
- include=true: 사용자 문제, 제품 맥락, 경험 변화, 의사결정, 운영 효율 등 "왜/누구를 위해"가 담긴 글.
  **누군가(고객·운영자·개발자)의 일이나 경험이 실제로 바뀐 이야기**가 글의 중심에 있어야 한다.
  ✔ **실제 운영 중에 겪은 문제를 기술로 푼 기록은 포함한다.** 서비스·데이터·배포를 운영하는 팀이
    장애·지연·작업 실패·데이터 오류·반복 수작업 같은 문제를 실제로 겪었고, 그것을 어떻게 풀었는지가 있으면 된다.
    사용자 경험뿐 아니라 운영 과정의 경험을 어떻게 기술로 해결했는지도 기획자가 볼 가치가 있다.
    기술 설명이 길어도, "운영에서 이런 문제가 있었다 → 이렇게 풀었다"가 글의 뼈대면 포함이다.
- include=false:
  · 순수 기술 구현 디테일 — 라이브러리·프레임워크 사용법, 설정·환경 구축 방법, 성능 튜닝 수치만, 코드 리뷰
  · 기술 개념·내부 동작 설명 — 런타임·언어 기능·도구의 원리를 풀어 주는 글(개발자의 이해를 돕는 것만으로는 부족하다)
  · 프레임워크 체험기·토이 프로젝트 후기 — 실제 서비스·운영에서 겪은 문제가 아니다
  · 행사·컨퍼런스 참관기·후기·회고 — 다녀와서 배운 점·인사이트를 정리한 글도 제외(우리 제품·운영에서 바뀐 것이 아니다)
  · 조직 문화·팀 소개·인터뷰·입사/인턴 후기·워크샵 — 개인이나 팀이 일하는 방식을 돌아본 글도 제외
  · 브랜딩·마케팅 캠페인 소개 — 단, 그 과정에서 **제품 화면·기능이 실제로 바뀐 이야기**가 중심이면 포함
  · 행사·밋업·컨퍼런스 공지와 신청 안내, 세션 소개, 채용 공고 — **주제가 제품 이야기여도** 글의 목적이 홍보·모집이면 제외
글 전체를 읽고 판단한다. 단, 긴 글 어딘가에 "의사결정", "운영" 같은 말이 나온다는 이유만으로 통과시키지 마라 —
글이 **주로** 무엇을 다루는지가 기준이다.
reason 은 한국어 한 문장으로, 판단 근거를 글 내용에 기대어 쓴다.`;

// 본문 전체를 넣는다 — 예전엔 앞 3,000자만 봐서 84%의 글을 앞부분만 보고 판정했다
export async function gateArticle(title: string, text: string): Promise<{ include: boolean; reason: string }> {
  return json(
    GATE_SYS,
    `제목: ${title}\n\n본문:\n${text}`,
    obj({ include: { type: Type.BOOLEAN }, reason: str(10) }),
    512,
  );
}

/* ───────────── 2차 상세 분석 ───────────── */

const ANALYZE_SYS = `너는 국내 테크 블로그 글을 "기획자 관점"으로 재구성하는 편집자다.
원문을 문제 정의 → 가설/기술 → 경험 변화 → 기회 흐름으로 읽고 JSON 으로 정리한다. 모든 문장은 한국어 존댓말(~해요).
- hook: 클릭하고 싶어지는 미끼 문장. 결론을 스포일러하지 마라.
- tags: 관점 태그 2~4개 (기술명이 아니라 관점: "대기 시간 줄이기", "운영 자동화" 등).
- audience: 가장 도움될 직무 하나.
- conclusion: "결론부터 말하면" — 배경 설명 말고 판단 기준/결론만.
- before/after: 기술 적용 전/후 사용자가 겪는 상황 변화.
- productPatterns: 기업에 종속되지 않는 재사용 가능한 패턴명 (예: "Local First Processing").
- plannerQuestions: 자기 서비스에 대입해볼 질문. 정답/아이디어를 제시하지 말고 반드시 질문형.
- tradeoffs: 기대할 수 있는 것 / 함께 고려할 조건.
- quickView.summary: 정확히 3줄 요약.
- problem.items / technology / experienceImpact 의 originalExcerpt:
  ⚠️ 원문에 실제로 등장하는 문장을 한 글자도 바꾸지 않고 그대로 복사한다. 20~120자. 요약·번역·띄어쓰기 수정 금지.
- discussionQuestions: 찬반이 갈리는 질문과 선택지 2~4개. 정답을 유도하지 마라.
숫자·고유명사는 원문에 있는 것만 쓴다.`;

const excerpt: Schema = str(8);
const LEARNING_SCHEMA: Schema = obj({
  hook: str(10),
  tags: strArr(2, 4),
  audience: { type: Type.STRING, enum: ["PM", "기획자", "디자이너", "데이터분석가", "프로덕트오너"] },
  difficulty: { type: Type.STRING, enum: ["입문", "중급", "심화"] },
  readingTime: { type: Type.INTEGER },
  conclusion: str(20),
  before: str(15),
  after: str(15),
  productPatterns: strArr(1, 3),
  plannerQuestions: strArr(2, 4),
  tradeoffs: obj({ benefits: strArr(1, 4), considerations: strArr(1, 4) }),
  quickView: obj({ summary: strArr(3, 3), whyItMatters: strArr(1, 3), keywords: strArr(2, 6) }),
  problem: obj({
    items: { type: Type.ARRAY, minItems: "1", maxItems: "3", items: obj({ title: str(4), description: str(15), originalExcerpt: excerpt }) },
  }),
  technology: {
    type: Type.ARRAY,
    minItems: "1",
    maxItems: "4",
    items: obj({ name: str(2), simpleExplanation: str(10), plannerExplanation: str(10), originalExcerpt: excerpt }),
  },
  experienceImpact: {
    type: Type.ARRAY,
    minItems: "1",
    maxItems: "3",
    items: obj({ technology: str(2), capability: str(5), uxImpact: str(4), description: str(10), originalExcerpt: excerpt }),
  },
  discussionQuestions: {
    type: Type.ARRAY,
    minItems: "1",
    maxItems: "2",
    items: obj({ question: str(10), options: strArr(2, 4) }),
  },
});

export async function analyzeArticle(title: string, text: string): Promise<Learning> {
  return json<Learning>(ANALYZE_SYS, `제목: ${title}\n\n원문:\n${text}`, LEARNING_SCHEMA, 8192);
}

/* ───────────── 글 상세 요약 · 읽기 전에 알아두면 좋은 개념 ───────────── */

/**
 * 혜란 님 "글 상세 요약 생성 프롬프트"(hyeran/techblog-article-detail-prompt.md)를 그대로 옮겼다.
 * 문서가 권하는 대로 예시 1개를 user 메시지 앞에 넣고, 원문에 없는 수치·문장 길이는 코드로 한 번 더 거른다.
 */
const DETAIL_SYS = `당신은 한국 테크기업 블로그 글을 비개발자(PM/PO/기획자, 마케터, 디자이너, 바이브 코더, AI·기술 트렌드에 관심 있는 사람)를 위해 쉽게 설명하는 큐레이터입니다.
주어진 글을 읽고, 독자가 원문을 읽을지 판단하고 읽을 준비를 할 수 있도록 요약과 개념 설명을 만듭니다.

## summary

- what (무슨 이야기야?): 1~2문장으로 글 전체를 쉽게 설명
- why (왜 했어?): 1~2문장으로 글이 다루는 문제와 배경 설명
- actions (어떻게 했어?): 1~2문장으로 어떻게 적용했는지 설명
- results (어떤 결과가 있었어?): 1~2문장으로 어떤 결과나 변화가 있었는지 설명
- takeaways (그래서 뭘 배울 수 있어?): 기획적으로 얻어갈 수 있는 포인트 간략히 소개. 최대 3개, 이 글에만 해당하지 않고 범용적으로 적용할 수 있게 표현

## concepts (용어)

이 글을 이해하기 위해 알아야 할 기술적 용어를 간략하게 설명합니다. 최대 5개. SQL, LLM, 토큰, MCP와 같이 이미 알려진 표현은 제외합니다.

- name: 용어 이름. 약어가 있다면 괄호로 풀네임 표시
- description (이게 뭐야?): 용어의 사전적 정의를 비전문가가 이해할 수 있게 쉽게 풀어서 설명
- context (이 글에서 왜 나와?): 좀 더 이해하기 쉽게 이 글에서 무슨 역할을 하는지 1~2문장으로 설명
- 업계에서 실제로 통용되는 용어만 고릅니다. 글쓴이 회사가 붙인 제품·기능·조직 이름(예: ChatGamesight, CoS, ALF)은 용어로 고르지 마세요. 원문이 뜻을 풀어 주지 않는 약어의 뜻을 짐작해 쓰지 마세요.
- description 에 다른 전문 용어(런타임, 인터페이스, 프로토콜 등)를 또 쓰지 마세요. 그 용어를 모르는 사람도 읽히도록 무엇을 해 주는지로 풀어 씁니다.

## 작성 원칙

- 원문이 영어여도 한국어로 씁니다. 친근하지만 과장 없는 존댓말(~습니다/~요)
- 요약은 원문을 대체하지 않습니다. 원문을 읽고 싶게 만드는 Soft Landing입니다.
- 글에 없는 내용, 수치를 지어내지 마세요. 원문에 있는 수치만 사용하세요.

## 출력

다음 JSON 객체 하나만 출력합니다.
{ "summary": { "what": "...", "why": "...", "actions": "...", "results": "...", "takeaways": ["..."] }, "concepts": [{ "name": "...", "description": "...", "context": "..." }] }`;

const DETAIL_EXAMPLE = `[예시]
입력: LINE 기술 블로그 「LLM이 만든 SQL을 믿고 실행하기까지: A2A 기반의 대화형 BI 애플리케이션 개발기」
출력:
${JSON.stringify({
  summary: {
    what: "LINE Game Platform실이 질문을 하면 SQL로 바꿔 실행하고 결과를 보여주는 대화형 BI 서비스(ChatGamesight)를 만들며, 운영 중에도 믿고 쓸 수 있도록 설계한 구조와 안전장치를 소개합니다.",
    why: "지표 정의와 맥락이 여러 곳에 흩어져 있어 비데이터 직군은 답을 얻기 어렵고, 데이터 담당자는 반복 문의에 시달렸습니다. LLM을 붙여 보니 실행은 되지만 틀린 ‘그럴듯한 오답’과 권한·개인정보를 침해할 수 있는 위험한 쿼리가 서비스 전체의 신뢰를 흔들었습니다.",
    actions: "판단을 하나의 에이전트에 몰지 않고 역할별 에이전트로 나눈 뒤, 지표 정의와 데이터 간 관계를 정리한 지식 기반을 먼저 찾아보고 답하게 했습니다. 생성된 SQL은 실행 직전에 별도 검증 장치가 권한과 민감 정보 노출을 검사해 막고, 무엇이 문제이고 어떻게 고치면 되는지 함께 알려주도록 했습니다.",
    results: "정식 릴리스 후 반복 문의와 수작업 리포팅 부담이 일부 줄었고, 쿼리를 숨기지 않고 보여주며 사람이 확인·수정할 수 있게 한 점이 사용자 신뢰를 높였습니다. 다만 2~3단계 떨어진 간접 관계에서는 답변 정확도가 불안정해, 이 경험을 이후 Graph DB 설계의 기준으로 삼을 예정입니다.",
    takeaways: [
      "틀린 답을 자신 있게 내놓는 것이 에러보다 신뢰를 더 크게 떨어뜨릴 수 있습니다.",
      "사용자가 빠뜨린 조건을 시스템이 알아서 채워 주면 묻고 답하는 수고가 줄어듭니다.",
      "막을 때는 이유와 고칠 방법을, 답할 때는 근거를 함께 보여주면 사용자가 결과를 더 믿습니다.",
    ],
  },
  concepts: [
    {
      name: "BI (Business Intelligence)",
      description: "회사에 쌓인 데이터를 지표, 대시보드, 리포트로 정리해 지금 무슨 일이 벌어지는지 빠르게 판단하도록 돕는 체계입니다.",
      context: "이 글의 ChatGamesight는 대시보드를 뒤지는 대신 채팅하듯 질문하면 답을 주는 ‘대화형 BI’입니다.",
    },
    {
      name: "A2A (Agent-to-Agent)",
      description: "여러 AI 에이전트가 서로 일을 주고받을 때 무엇을 받고 무엇을 돌려줄지 정해 둔 공개 통신 규약입니다.",
      context: "역할별로 나눈 에이전트들의 입출력과 실패 유형을 A2A로 ‘계약’처럼 정해, 한 에이전트를 고쳐도 전체가 흔들리지 않게 했습니다.",
    },
    {
      name: "RAG (Retrieval-Augmented Generation)",
      description: "AI가 답하기 전에 관련 자료를 먼저 찾아보고, 그 내용을 근거로 답하게 하는 방식입니다.",
      context: "지표 정의, 이벤트 문서, 대시보드 설명 등을 찾아 질문에 빠진 조건을 채우고 수치와 배경 설명을 함께 답하는 데 쓰였습니다.",
    },
    {
      name: "온톨로지 (Ontology)",
      description: "어떤 분야의 개념들과 그 사이의 관계를 정해진 구조로 정리해 둔 지식 체계입니다.",
      context: "지표, 이벤트, 게임, 대시보드가 서로 어떻게 연결되는지 정리해 두고, 에이전트들이 같은 기준으로 판단하는 공통 지식 기반으로 썼습니다.",
    },
    {
      name: "Vector DB (벡터 데이터베이스)",
      description: "글이나 이미지를 의미를 담은 숫자 묶음(벡터)으로 바꿔 저장하고, 의미가 비슷한 것을 빠르게 찾아주는 데이터베이스입니다.",
      context: "관계 표현에 더 이상적인 Graph DB 대신 빠르게 시작할 수 있는 Vector DB로 지식 기반을 먼저 만들었지만, 간접 관계를 다룰 때 한계가 드러났습니다.",
    },
  ],
})}
[예시 끝 — 아래 글로 같은 형식의 JSON 을 만드세요]`;

const DETAIL_SCHEMA: Schema = obj({
  summary: obj({ what: str(10), why: str(10), actions: str(10), results: str(10), takeaways: strArr(1, 3) }),
  concepts: {
    type: Type.ARRAY,
    minItems: "1",
    maxItems: "5",
    items: obj({ name: str(1), description: str(10), context: str(10) }),
  },
});

type DetailRaw = {
  summary: { what: string; why: string; actions: string; results: string; takeaways: string[] };
  concepts: { name: string; description: string; context: string }[];
};

/** 문서가 "이미 알려진 표현"으로 꼽은 용어 — 괄호 앞 이름으로 비교한다 */
const KNOWN_TERMS = new Set(["SQL", "LLM", "토큰", "MCP"]);

/** 문서 "검증 방법"의 코드 판정 — 원문에 없는 수치 · 1~2문장을 넘는 요약 칸 */
function detailProblem(d: DetailRaw, source: string): string | null {
  const s = d.summary;
  const texts = [s.what, s.why, s.actions, s.results, ...s.takeaways, ...d.concepts.flatMap((c) => [c.description, c.context])];
  const badNum = texts.flatMap(numbersIn).find((n) => !source.includes(n));
  if (badNum) return `원문에 없는 수치 "${badNum}"`;
  const long = (["what", "why", "actions", "results"] as const).find((k) => sentences(s[k]).length > 2);
  if (long) return `${long} 가 2문장을 넘음`;
  return null;
}

export async function buildDetail(
  a: { title: string; company: string; url: string; text: string },
  log: (m: string) => void = () => {},
): Promise<{ overview: Overview; concepts: Concept[] } | null> {
  const input = `${DETAIL_EXAMPLE}\n\n제목: ${a.title}\n회사: ${a.company}\nURL: ${a.url}\n\n본문:\n${a.text}`;
  let feedback = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const d = await json<DetailRaw>(DETAIL_SYS, input + feedback, DETAIL_SCHEMA, 8192, DETAIL_MODEL);
    const problem = detailProblem(d, a.text);
    if (problem) {
      log(`    · 상세 요약 게이트 탈락: ${problem}`);
      feedback = `\n\n[지난 답이 규칙에 걸렸습니다: ${problem}. 규칙을 지켜 다시 쓰세요.]`;
      continue;
    }
    const s = d.summary;
    return {
      overview: { what: s.what, why: s.why, actions: s.actions, results: s.results, takeaways: s.takeaways.slice(0, 3) },
      concepts: d.concepts
        .filter((c) => !KNOWN_TERMS.has(c.name.replace(/\s*\(.*$/, "").trim()))
        .map((c) => ({ term: c.name, what: c.description, why: c.context.replace(/^(?:이\s*)?글에서(?:는)?\s*/, "") }))
        .filter((c) => c.term.trim() && c.what.trim() && c.why.trim()),
    };
  }
  return null;
}

/* ───────────── "더 들어가 볼까요?" 1단계 ───────────── */

const GUIDE_SYS = `너는 기술 블로그 글을 **개발을 전혀 모르는 사람**(기획자·디자이너·마케터)에게 풀어 주는 한국어 편집자다.
입력은 번호 매긴 원문 블록(블록당 앞부분만)이다. 반드시 JSON 하나만 출력해라. 모든 문장은 존댓말(~해요).
1) lead: 한눈에 보는 글. what(무엇을 했대요) · why(왜 했대요) · how(어떻게 했대요) · soWhat(그래서 어떻게 됐대요). 각 1~2문장.
2) points: 기획자가 가져갈 포인트 2~3개.
3) terms: 가이드에 쓴 단어 중 개발을 모르면 막힐 단어와 쉬운 풀이.
4) sections: 글이 다룬 **문제·국면을 하나씩** 맡는 칸. **3~6개**(아주 짧은 글만 2개).
   - ⚠️ **리드에 여러 개를 나열했으면 나열한 것마다 칸을 만든다.**
     "여섯 가지를 만들었어요 — 수량, 시간, 날짜, 목록, 팝업, 스크롤"이라고 써 놓고
     칸을 셋만 만들면, 읽는 사람은 "왜 저것만 다뤘지?" 하게 된다(실제로 그랬다).
     여섯을 꼽았으면 여섯을 다룬다. 못 다룰 것은 리드에서도 꼽지 마라.
   - lead 의 "왜 했대요"에 뭉쳐 적은 것들을 **여기서 하나씩 풀어 준다.**
     문제가 셋이면 칸도 셋이다. 두 문단으로 요약하고 넘어가지 마라 — 그러면 위 요약과 똑같아진다.
   - **글이 이야기한 순서대로** 놓는다.
   - question: **물음표로 끝나는 질문형 소제목.** 존댓말로 쓴다 — "왜 검색이 안 맞았을까요?"
     ("~할까?", "~했대?" 같은 반말은 쓰지 마라. 본문이 존댓말이라 카드 안에서 말투가 갈린다.)
   - ⚠️ 칸 전부를 "왜 ~였나요?"로 만들지 마라. 문제만 네 번 반복하면 글이 한 자리에 머문다.
     글이 실제로 다룬 것에 맞춰 **묻는 각도를 바꾼다** —
     문제(왜 그랬대?) · 선택(뭘 골랐대?) · 방법(어떻게 했대?) · 반응(사람들은 뭐래?).
   - ⚠️ 질문은 **lead 에 이미 나온 이야기**를 파고드는 것이어야 한다.
     lead 에 없던 새 개념을 소제목으로 올리지 마라 — 원문을 안 본 사람은 거기서 길을 잃는다.
   - ⚠️ 질문에 **기술 이름을 쓰지 마라.** "Cursor 기반 ItemReader는 어떤 역할인가요?"가 아니라
     "데이터가 많으면 왜 터지는 거야?"처럼 **그 기술이 해결한 문제**로 물어라.
   - problem: 이 칸이 다루는 **문제** 한 문장. 무엇이 안 되고 있었는지.
   - paras: **한 개만** 쓴다(1~2문장, 200자 이내, 존댓말). 이 단계는 뼈대를 잡는 곳이라
     길게 쓰면 출력이 잘려 **뒤쪽 칸이 통째로 사라진다**(실제로 그랬다).
     그 한 문단은 **어떻게 풀었는지**를 적는다 — 문제는 위 problem 이 맡는다.
   - outcome: **그래서 이건 어떻게 됐어요?** 이 칸 하나의 결말을 한 문장으로.
     위 soWhat 은 글 전체의 결말이라 칸마다의 답이 안 된다. **이 칸에서 다룬 것만** 말한다.
     원문에 그 칸의 결과가 없으면 빈 문자열로 둔다.
   - blocks: 그 답을 쓸 때 **실제로 근거가 된 원문 블록 번호를 전부** 적는다(1~3개).
     한 개만 적지 마라 — 답은 여러 군데를 모아 쓰는데 근거가 한 문단뿐이면
     읽는 사람은 "이걸로 저 답이 나온다고?" 하게 된다. 전부 실제 번호여야 한다.
   - terms: 그 칸에 쓴 단어 중 개발을 모르면 막힐 단어(없으면 빈 배열).
숫자는 원문에 글자 그대로 있는 것만 쓴다.`;

const GUIDE_SCHEMA: Schema = obj({
  lead: obj({ what: str(15), why: str(), how: str(), soWhat: str() }),
  points: strArr(1, 3),
  terms: { type: Type.ARRAY, items: obj({ term: str(), plain: str() }) },
  sections: {
    type: Type.ARRAY,
    minItems: "2",
    maxItems: "6",
    items: obj({
      question: str(5),
      problem: str(5),
      paras: strArr(1, 1),
      outcome: { type: Type.STRING },
      blocks: { type: Type.ARRAY, items: { type: Type.INTEGER }, minItems: "1", maxItems: "3" },
      terms: { type: Type.ARRAY, items: str() },
    }),
  },
});

/**
 * 1단계 입력 — 글 끝까지 모든 블록을 넣는다(블록당 앞 300자).
 * 예전엔 블록당 140자 · 전체 5,000자에서 끊어 80건 중 51건이 뒤쪽 블록을 못 봤다.
 * 소제목은 짧아도 글의 뼈대라 넣고, 그 밖에 15자 미만(이미지 캡션 조각·"감사합니다" 등)은 뺀다.
 */
export const GUIDE_BLOCK_CHARS = 300;
export function guideInputBlocks(blocks: Block[]): Block[] {
  return blocks.filter((b) => b.heading ? b.text.length > 0 : b.text.length >= 15);
}
function numberedHeads(title: string, blocks: Block[]): string {
  const lines = guideInputBlocks(blocks).map((b) => `[${b.n}] ${b.heading ? "## " : ""}${b.text.slice(0, GUIDE_BLOCK_CHARS)}`);
  return `제목: ${title}\n\n${lines.join("\n")}`;
}

/* ───────────── "더 들어가 볼까요?" 2단계 (DEEP_SYS 원문) ───────────── */

const DEEP_SYS = `너는 기술 블로그 글을 **개발을 전혀 모르는 사람**(기획자·디자이너·마케터)에게
풀어 주는 한국어 편집자다. 아래 "원문 발췌"만 읽고 질문마다 답을 쓴다.
반드시 아래 JSON 하나만 출력해라(설명·코드펜스 금지).
{"answers":[{"n":1,"problem":"","paras":["",""],"outcome":""}],"terms":[{"term":"","plain":""}]}

1) n: 질문 번호. 준 질문을 **전부** 답한다(빠뜨리지 마라).
1-1) problem: 이 칸이 다루는 **문제** 한 문장. 무엇이 안 되고 있었는지.
   해결책을 여기 쓰지 마라 — 해결은 아래 paras 가 맡는다.

2) paras: **어떻게 풀었는지.** 2~3개, 각 1~2문장, 각 220자 이내, 존댓말(~해요).
   · 문제는 위 problem 이 맡았으니 여기는 **해결만** 담는다.
   · **문단 하나 = 사실 하나.** 앞 문단을 다시 풀어 쓴 문단은 쓰지 마라. 서로 다른 것을 말해야 한다.
   · 문단마다 발췌에 있는 **구체적인 것**을 하나는 담는다. 담을 게 없으면 그 문단은 빼라.
     구체적인 것 = **숫자·기간·비교 대상·사용자가 겪은 일·팀이 내린 선택**.
   · ⚠️ **옵션·속성·API 이름은 쓰지 마라.** 부품 이름(Quantity Picker, Dialog)까지는 괜찮지만,
     그 부품의 **설정값**을 나열하는 순간 개발 문서가 된다. 읽는 사람은 그걸 쓸 일이 없다.
     이런 말 대신 **우리말로 풀어 쓴다**(뜻을 빼지 말고 표현만 바꾼다):
       minuteStep → 분 단위 간격 · locale → 언어·지역 설정 · props → 설정값 ·
       비활성 상태 → 선택할 수 없는 상태 · 팝오버 → 떠 있는 작은 창 · 패딩 → 여백 ·
       네이티브 폼 → 웹 기본 양식 · 렌더링 → 화면에 그리기 · 푸터 → 아래쪽 영역
     Portal · input · Date 객체처럼 **바꿔 쓸 말이 없으면 그 얘기 자체를 빼라**
     (읽는 사람이 쓸 일이 없는 내용이다). 부품 이름(Quantity Picker, Dialog)은 그대로 써도 된다.
     **그게 사용자에게 무엇을 해 주는지**로 바꿔 쓴다.
     ⚠️ 위 목록은 **바꿔 쓸 말의 사전**이다. 예시 문장을 그대로 베껴 쓰지 마라 —
        이 글에 없는 내용을 쓰면 거짓이 된다.
   · ⚠️ **말투를 섞지 마라.** 문단·결말 **전부 "~해요"** 로 끝낸다.
   · 2개로 끝내지 마라. 발췌에 근거가 남아 있는 한 3개까지 쓴다.
   · ⚠️ **개수만 말하고 넘어가지 마라.** "여섯 가지를 추가했어요"라고 썼으면
     **그 여섯이 무엇인지 그 자리에서 이름을 적는다.**
   · 이런 문장은 쓰지 마라(아무것도 말하지 않는다):
     "~때문이에요"로만 끝나는 되풀이 · "추가적인 절차가 필요합니다" · "~라고 볼 수 있어요" ·
     "중요한 역할을 합니다" · 발췌에 없는 일반론.
2-1) outcome: **그래서 이건 어떻게 됐어요?** 이 질문 하나의 결말을 한 문장으로.
   해결 방법을 다시 쓰지 마라 — 그건 이미 위에 있다. 발췌에 결과가 없으면 빈 문자열로 둔다.
2-2) terms: **네가 방금 쓴 문장 안에서** 최대 6개 고른다. 기준은 하나다 —
   **"이 말을 모르면 내가 쓴 이 문장을 이해할 수 없는가?"**

3) **발췌에 있는 내용만** 쓴다. 발췌에 없으면 지어내지 말고 그 질문은 짧게 답한다.
4) 구현 과정을 나열하지 마라. 기술 이름이 나오면 **그게 무엇을 해결했는지**로 바꿔 써라.
5) 숫자·고유명사는 발췌에 있는 것만. 블록 번호를 문장에 쓰지 마라.
6) 발췌 문장을 그대로 복사하지 말고 네 말로 다시 써라.`;

const DEEP_SCHEMA: Schema = obj({
  answers: {
    type: Type.ARRAY,
    minItems: "1",
    items: obj({ n: { type: Type.INTEGER }, problem: str(5), paras: strArr(1, 3), outcome: { type: Type.STRING } }),
  },
  terms: { type: Type.ARRAY, maxItems: "6", items: obj({ term: str(), plain: str() }) },
});

type Deep = {
  answers: { n: number; problem: string; paras: string[]; outcome: string }[];
  terms: { term: string; plain: string }[];
};

export async function buildReadingGuide(
  title: string,
  html: string,
  log: (m: string) => void = () => {},
): Promise<ReadingGuide | null> {
  const blocks = splitBlocks(html);
  if (blocks.length < 3) return null;
  const input = numberedHeads(title, blocks);

  // 1단계 — 탈락하면 한 번 더 물어본다
  let stage1: ReadingGuide | null = null;
  let feedback = "";
  for (let attempt = 0; attempt < 2 && !stage1; attempt++) {
    const raw = await json<ReadingGuide>(GUIDE_SYS, input + feedback, GUIDE_SCHEMA, 6000);
    const r = gateGuide(raw, blocks);
    if (r.ok) stage1 = r.guide;
    else {
      log(`  · 가이드 1단계 게이트 탈락: ${r.reason}`);
      feedback = `\n\n[지난 답이 규칙에 걸렸다: ${r.reason}. 규칙을 지켜 다시 써라.]`;
    }
  }
  if (!stage1) return null;

  // 2단계 — 고른 근거 블록의 전문을 읽고 다시 쓴다. 실패하면 1단계 답을 그대로 둔다.
  try {
    const qs = stage1.sections.map((s, i) => `${i + 1}. ${s.question}`).join("\n");
    const picked = [...new Set(stage1.sections.flatMap((s) => s.blocks))].sort((a, b) => a - b);
    const excerpts = picked.map((n) => blocks[n - 1].text).join("\n\n");
    const deep = await json<Deep>(DEEP_SYS, `질문 목록:\n${qs}\n\n원문 발췌:\n${excerpts}`, DEEP_SCHEMA, 8192);
    const merged: ReadingGuide = structuredClone(stage1);
    for (const a of deep.answers ?? []) {
      const s = merged.sections[a.n - 1];
      if (!s) continue;
      if (a.problem) s.problem = a.problem;
      if (a.paras?.length) s.paras = a.paras;
      s.outcome = a.outcome ?? s.outcome;
      s.terms = [...new Set([...s.terms, ...(deep.terms ?? []).map((t) => t.term)])];
    }
    const seen = new Set(merged.terms.map((t) => t.term));
    for (const t of deep.terms ?? []) if (!seen.has(t.term)) merged.terms.push(t);
    const r = gateGuide(merged, blocks);
    if (r.ok) return r.guide;
    log(`  · 가이드 2단계 게이트 탈락 → 1단계 답 유지: ${r.reason}`);
  } catch (e) {
    log(`  · 가이드 2단계 실패 → 1단계 답 유지: ${(e as Error).message}`);
  }
  return stage1;
}

