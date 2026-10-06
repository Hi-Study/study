/**
 * 1단계(배제 판정) · 상세 분석 · 2단계("더 들어가 볼까요?" 칸 만들기) 프롬프트.
 * 기준 문서: docs/01_분류기준.md 1~2단계, docs/참고/더-들어가-볼까요-기준.md
 */
import { Type, type Schema } from "@google/genai";
import { json, obj, str, strArr } from "../shared/ai";
import { splitBlocks, type Block } from "../0-collect/content";
import type { Learning, ReadingGuide } from "../shared/types";
import { gateGuide } from "./guide-gate";

/* ───────────── 1차 게이트 (저비용) ───────────── */

const GATE_SYS = `너는 기술 블로그 큐레이터다. 이 글이 기획자·PM·디자이너에게 읽을 가치가 있는지 판단한다.
- include=true: 사용자 문제, 제품 맥락, 경험 변화, 의사결정, 운영 효율 등 "왜/누구를 위해"가 담긴 글.
- include=false: 순수 기술 구현 디테일(라이브러리 사용법, 설정, 성능 튜닝 수치만, 코드 리뷰, 행사 공지/채용)만 다루는 글.
reason 은 한국어 한 문장으로, 판단 근거를 글 내용에 기대어 쓴다.`;

export async function gateArticle(title: string, text: string): Promise<{ include: boolean; reason: string }> {
  return json(
    GATE_SYS,
    `제목: ${title}\n\n본문(앞부분):\n${text.slice(0, 3000)}`,
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
  return json<Learning>(ANALYZE_SYS, `제목: ${title}\n\n원문:\n${text.slice(0, 14000)}`, LEARNING_SCHEMA, 8192);
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

function numberedHeads(title: string, blocks: Block[]): string {
  let budget = 5000;
  const lines: string[] = [];
  for (const b of blocks) {
    const line = `[${b.n}] ${b.text.slice(0, 140)}`;
    if (budget - line.length < 0) break;
    budget -= line.length;
    lines.push(line);
  }
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

