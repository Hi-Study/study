/**
 * 글 상세 v2 — hyeran/techblog-article-detail-prompt-v2.md 의 출력(lead·points·concepts·tools).
 * Claude Code 초기 백필(scripts/run/import-detail-v2.mts)과 이후 Gemini 신규 글 경로가 같은 검사기를 쓴다.
 * 검사기는 형식·개수·지어낸 숫자만 본다 — 어떤 개념이 중요한지 같은 내용 판단은 프롬프트(모델)에 맡긴다.
 */
import type { Learning } from "../shared/types";
import { numbersIn } from "./guide-gate";

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

/**
 * 문제가 없으면 [] — 있으면 사유 목록. source 는 원문 텍스트(지어낸 숫자 검사용).
 * allowNumbers: 사람이 원문과 대조해 맞다고 확인한 숫자(예: "1.9 million" → "190만", "서른아홉" → "39")
 */
export function validateDetailV2(raw: unknown, source: string, allowNumbers: string[] = []): string[] {
  const d = raw as DetailV2;
  if (!d || typeof d !== "object") return ["JSON 객체가 아님"];
  const errs: string[] = [];

  const lead = d.lead ?? ({} as DetailV2["lead"]);
  for (const k of ["what", "why", "how", "soWhat"] as const) if (blank(lead[k])) errs.push(`lead.${k} 비어 있음`);

  if (!Array.isArray(d.points) || d.points.length < 2 || d.points.length > 3) errs.push("points 는 2~3개여야 함");
  else d.points.forEach((p, i) => blank(p) && errs.push(`points[${i}] 비어 있음`));

  if (!Array.isArray(d.concepts) || d.concepts.length > 3) errs.push("concepts 는 0~3개여야 함");
  else
    d.concepts.forEach((c, i) => {
      for (const k of ["term", "what", "why"] as const) if (blank(c?.[k])) errs.push(`concepts[${i}].${k} 비어 있음`);
      if (!blank(c?.term) && acronymWithoutFullName(c.term)) errs.push(`concepts[${i}] "${c.term}" 약어 (풀네임) 형식 아님`);
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
