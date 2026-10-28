/**
 * 글 상세 v2 — hyeran/techblog-article-detail-prompt-v2.md 의 출력(lead·points·concepts·tools).
 * Claude Code 초기 백필(scripts/run/import-detail-v2.mts)과 이후 Gemini 신규 글 경로가 같은 검사기를 쓴다.
 * 검사기는 형식·개수·문장 수·지어낸 숫자만 본다 — 어떤 개념이 중요한지 같은 내용 판단은 프롬프트(모델)에 맡긴다.
 */
import { Type, type Schema } from "@google/genai";
import { obj, str, strArr } from "../shared/ai";
import type { Learning } from "../shared/types";
import { numbersIn, sentences } from "./guide-gate";

/**
 * hyeran/techblog-article-detail-prompt-v2.md 의 System prompt 를 글자 그대로 옮겼다 — 고치면 문서도 같이 고친다.
 * 배포 서버에는 hyeran/ 폴더가 없어 문서를 읽을 수 없다. 일치 여부는 npm run check-detail-prompt 로 확인한다.
 */
export const DETAIL_V2_SYSTEM = `너는 기술 블로그 글을 비개발자
(기획자·디자이너·마케터)에게 풀어 주는 한국어 편집자다.

반드시 JSON 객체 하나만 출력한다.
모든 문장은 존댓말(~해요)로 쓴다.

## lead

글을 한눈에 볼 수 있게 정리한다.

- what: 무엇을 했는지
- why: 왜 했는지
- how: 어떻게 했는지
- soWhat: 그래서 어떻게 됐는지

각 항목은 1~2문장으로 쓴다.

## points

기획자가 가져갈 포인트를 2~3개 쓴다.

## concepts

이 글의 핵심 문제와 해결 방법을 이해하는 데
꼭 필요한 낯선 기술 개념만 고른다.

각 개념을 고르기 전에 다음을 판단한다.

“이 개념을 몰라도 글의 핵심 문제와 해결 방법을 이해할 수 있는가?”

그렇다면 제외한다.

IT 업계에서 일반적으로 사용하는 말,
문맥만으로 이해할 수 있는 말,
글의 주변 기능에만 등장하는 말,
특정 회사의 제품·기능·도구·프로그램·조직 이름은 제외한다.

각 개념마다 다음을 설명한다.

- term: 개념 이름
- what: 이게 무엇인지
- why: 이 글에서 왜 나오는지

약어는 \`약어 (풀네임)\` 형식으로 쓴다.
풀네임을 확실히 알 수 없는 약어는 고르지 않는다.
약어가 아닌 개념에는 영문명을 덧붙이지 않는다.

애매하면 제외한다.
필요한 개념이 없으면 빈 배열로 출력하고,
최대 3개까지만 고른다.

## tools

글에 고유한 이름으로 등장해서, 독자가 외부에서 쓸 수 있는 서비스인지
이 회사 안에서만 쓰는 것인지 헷갈릴 만한 사내 도구·시스템만 고른다.

다음은 제외한다.

- 이름만 봐도 무엇인지 알 수 있는 것
- 글의 문맥만으로 무엇인지 알 수 있는 것
- 글에 잠깐 언급되고 지나가는 것
- 코드 속 부품 이름(클래스·함수 등)

애매하면 제외한다.

각 항목은 다음과 같이 쓴다.

- name: 이름
- description: 사내에서만 쓰는 것인지 밝히고, 누가 무엇을 위해 만들었는지 한 문장으로 설명

해당하는 것이 없으면 빈 배열로 출력하고,
최대 2개까지만 고른다.`;

/** 문서 "User message" 형식 */
export const detailV2Input = (a: { title: string; company: string; url: string; text: string }) =>
  `제목: ${a.title}\n회사: ${a.company}\nURL: ${a.url}\n\n본문:\n${a.text}`;

/** 문서 "출력 스키마"와 같은 구조 */
export const DETAIL_V2_SCHEMA: Schema = obj({
  lead: obj({ what: str(), why: str(), how: str(), soWhat: str() }),
  points: strArr(2, 3),
  concepts: { type: Type.ARRAY, maxItems: "3", items: obj({ term: str(), what: str(), why: str() }) },
  tools: { type: Type.ARRAY, maxItems: "2", items: obj({ name: str(), description: str() }) },
});

export interface DetailV2 {
  lead: { what: string; why: string; how: string; soWhat: string };
  points: string[];
  concepts: { term: string; what: string; why: string }[];
  tools: { name: string; description: string }[];
}

const blank = (v: unknown) => typeof v !== "string" || !v.trim();

/** 약어만으로 된 이름(예: SSO, JWT)인데 풀네임이 없으면 걸린다 — "UI 테스트"처럼 낱말과 붙은 이름, GraphQL 같은 이름은 보지 않는다 */
function acronymWithoutFullName(term: string): boolean {
  return /^[A-Z][A-Z0-9]+s?$/.test(term.trim());
}

/** "스모크 테스트 (Smoke Test)"처럼 약어가 아닌 이름 뒤에 영문 괄호 — 문서 "약어가 아닌 개념에는 영문명을 덧붙이지 않는다" */
function englishOnNonAcronym(term: string): boolean {
  const m = term.trim().match(/^(.+?)\s*\(([^)]*)\)/);
  if (!m || !/^[A-Za-z][A-Za-z\s-]*$/.test(m[2])) return false;
  const head = m[1].trim();
  // 띄어쓰기 없이 대문자가 둘 이상이면 약어로 본다(SSO, PoC, OAuth, ReAct …)
  const isAcronym = !/\s/.test(head) && (head.match(/[A-Z]/g) ?? []).length >= 2;
  return !isAcronym;
}

/**
 * 문제가 없으면 [] — 있으면 사유 목록. source 는 원문 텍스트(지어낸 숫자 검사용).
 * allowNumbers: 사람이 원문과 대조해 맞다고 확인한 숫자(예: "1.9 million" → "190만", "서른아홉" → "39")
 */
export function validateDetailV2(raw: unknown, source: string, allowNumbers: string[] = []): string[] {
  const d = raw as DetailV2;
  if (!d || typeof d !== "object") return ["JSON 객체가 아님"];
  const errs: string[] = [];

  const lead = d.lead ?? ({} as DetailV2["lead"]);
  for (const k of ["what", "why", "how", "soWhat"] as const) {
    if (blank(lead[k])) errs.push(`lead.${k} 비어 있음`);
    else if (sentences(lead[k]).length > 2) errs.push(`lead.${k} 가 2문장을 넘음`);
  }

  if (!Array.isArray(d.points) || d.points.length < 2 || d.points.length > 3) errs.push("points 는 2~3개여야 함");
  else d.points.forEach((p, i) => blank(p) && errs.push(`points[${i}] 비어 있음`));

  if (!Array.isArray(d.concepts) || d.concepts.length > 3) errs.push("concepts 는 0~3개여야 함");
  else
    d.concepts.forEach((c, i) => {
      for (const k of ["term", "what", "why"] as const) if (blank(c?.[k])) errs.push(`concepts[${i}].${k} 비어 있음`);
      if (!blank(c?.term) && acronymWithoutFullName(c.term)) errs.push(`concepts[${i}] "${c.term}" 약어 (풀네임) 형식 아님`);
      if (!blank(c?.term) && englishOnNonAcronym(c.term)) errs.push(`concepts[${i}] "${c.term}" 약어가 아닌데 영문명을 덧붙임`);
    });

  if (!Array.isArray(d.tools) || d.tools.length > 2) errs.push("tools 는 0~2개여야 함");
  else d.tools.forEach((t, i) => (blank(t?.name) || blank(t?.description)) && errs.push(`tools[${i}] 비어 있음`));

  if (errs.length) return errs;

  const dup = (xs: string[]) => xs.find((x, i) => xs.indexOf(x) !== i);
  const dupTerm = dup(d.concepts.map((c) => c.term.trim()));
  if (dupTerm) errs.push(`concepts 중복 "${dupTerm}"`);
  const dupTool = dup(d.tools.map((t) => t.name.trim()));
  if (dupTool) errs.push(`tools 중복 "${dupTool}"`);

  const texts = [
    ...Object.values(d.lead),
    ...d.points,
    ...d.concepts.flatMap((c) => [c.what, c.why]),
    ...d.tools.map((t) => t.description),
  ];
  const badNum = [...new Set(texts.flatMap(numbersIn))].filter((n) => !source.includes(n) && !allowNumbers.includes(n));
  if (badNum.length) errs.push(`원문에 없는 숫자 ${badNum.map((n) => `"${n}"`).join(", ")}`);

  return errs;
}

/** 기존 learning 을 복사해 overview·concepts·tools·detailPromptVersion 만 바꾼다 — 분류·태그·카드 문구는 그대로 */
export function mergeDetailV2(l: Learning, d: DetailV2): Learning {
  const t = (s: string) => s.trim();
  return {
    ...structuredClone(l),
    overview: {
      what: t(d.lead.what),
      why: t(d.lead.why),
      actions: t(d.lead.how),
      results: t(d.lead.soWhat),
      takeaways: d.points.map(t),
    },
    concepts: d.concepts.map((c) => ({ term: t(c.term), what: t(c.what), why: t(c.why) })),
    tools: d.tools.map((x) => ({ name: t(x.name), description: t(x.description) })),
    detailPromptVersion: 2,
  };
}
