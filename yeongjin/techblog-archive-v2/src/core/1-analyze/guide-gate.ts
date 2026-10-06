import type { Block } from "../0-collect/content";
import type { GuideSection, ReadingGuide } from "../shared/types";

/**
 * "더 들어가 볼까요?" 코드 게이트(gateGuide).
 * 프롬프트가 새도 여기서 걸린다. 규칙 표: docs/참고/더-들어가-볼까요-기준.md (2단계)
 */
export type GateResult = { ok: true; guide: ReadingGuide } | { ok: false; reason: string };

const IMPL_PART = /(Handler|Manager|Reader|Writer|Step|Processor|Service|Controller|Factory|Provider|Repository)$/;

const DEV_WORDS: [RegExp, string][] = [
  [/minuteStep/g, "분 단위 간격"],
  [/locale/gi, "언어·지역 설정"],
  [/props/g, "설정값"],
  [/비활성 상태/g, "선택할 수 없는 상태"],
  [/팝오버/g, "떠 있는 작은 창"],
  [/패딩/g, "여백"],
  [/네이티브 폼/g, "웹 기본 양식"],
  [/렌더링/g, "화면에 그리기"],
  [/푸터/g, "아래쪽 영역"],
];

const FORMAL = /(습니다|합니다)[.!]?\s*$/;

function bigrams(s: string): Set<string> {
  const t = s.replace(/\s+/g, "");
  const out = new Set<string>();
  for (let i = 0; i < t.length - 1; i++) out.add(t.slice(i, i + 2));
  return out;
}

/** 짧은 쪽 기준 겹침 비율 */
export function overlap(a: string, b: string): number {
  const A = bigrams(a);
  const B = bigrams(b);
  if (!A.size || !B.size) return 0;
  let hit = 0;
  for (const x of A) if (B.has(x)) hit++;
  return hit / Math.min(A.size, B.size);
}

function numbersIn(s: string): string[] {
  return s.match(/\d+(?:[.,]\d+)*/g) ?? [];
}

function numbersOk(s: string, source: string): boolean {
  return numbersIn(s).every((n) => source.includes(n));
}

function sentences(s: string): string[] {
  return s.split(/(?<=[.!?요])\s+/).filter(Boolean);
}

function plain(s: string): string {
  let out = s;
  for (const [re, to] of DEV_WORDS) out = out.replace(re, to);
  return out;
}

export function gateGuide(raw: ReadingGuide, blocks: Block[]): GateResult {
  const source = blocks.map((b) => b.text).join("\n");
  const g: ReadingGuide = structuredClone(raw);
  g.lead = {
    what: plain(g.lead?.what ?? ""),
    why: plain(g.lead?.why ?? ""),
    how: plain(g.lead?.how ?? ""),
    soWhat: plain(g.lead?.soWhat ?? ""),
  };

  // ① 리드
  if (g.lead.what.length < 15) return { ok: false, reason: "① 리드 what 이 15자 미만" };
  if (![g.lead.why, g.lead.how, g.lead.soWhat].some((x) => x.length >= 15))
    return { ok: false, reason: "① 리드 why/how/soWhat 이 전부 15자 미만" };

  // ④ 리드 숫자 대조
  for (const part of Object.values(g.lead))
    if (!numbersOk(part, source)) return { ok: false, reason: `④ 리드 숫자가 원문에 없음: ${part}` };

  const sections: GuideSection[] = [];
  for (const s0 of g.sections ?? []) {
    const s: GuideSection = {
      question: (s0.question ?? "").trim(),
      problem: plain(s0.problem ?? ""),
      paras: (s0.paras ?? []).map(plain).filter((p) => p.trim()),
      outcome: plain(s0.outcome ?? ""),
      blocks: (s0.blocks ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= blocks.length),
      terms: s0.terms ?? [],
    };

    // ② 질문형 존댓말
    if (!/요\?$/.test(s.question)) return { ok: false, reason: `② 질문형이 아님: ${s.question}` };
    // ③′ 근거 블록
    if (s.blocks.length === 0) return { ok: false, reason: `③′ 근거 블록 없음: ${s.question}` };
    // 말투 섞임
    if ([s.problem, ...s.paras, s.outcome].some((x) => FORMAL.test(x.trim())))
      return { ok: false, reason: `~습니다 말투 섞임: ${s.question}` };

    // ④ 칸 안 숫자 대조 — 그 문장만 지운다
    const keepSentences = (t: string) =>
      sentences(t)
        .filter((x) => numbersOk(x, source))
        .join(" ");
    s.problem = keepSentences(s.problem);
    s.paras = s.paras.map(keepSentences).filter(Boolean);
    s.outcome = keepSentences(s.outcome);

    // 문단끼리 55% 넘게 겹치면 뒤쪽을 지운다
    const paras: string[] = [];
    for (const p of s.paras) if (!paras.some((q) => overlap(p, q) > 0.55)) paras.push(p);
    s.paras = paras;
    // 결말 ↔ 글 전체 결말
    if (s.outcome && overlap(s.outcome, g.lead.soWhat) > 0.55) s.outcome = "";

    if (s.paras.length === 0) continue;
    sections.push(s);
  }

  // ③ 긴 글인데 칸이 너무 적음
  if (blocks.length >= 12 && sections.length < 2) return { ok: false, reason: "③ 긴 글인데 칸이 2개 미만" };
  if (sections.length === 0) return { ok: false, reason: "칸이 전부 탈락했다" };

  // ⑤ 용어는 가이드 문장에 실제로 나오는 말만, 구현 부품 이름 제외
  const guideText = [
    ...Object.values(g.lead),
    ...sections.flatMap((s) => [s.question, s.problem, ...s.paras, s.outcome]),
  ].join("\n");
  const termOk = (t: string) => !!t && guideText.includes(t) && !IMPL_PART.test(t);
  g.terms = (g.terms ?? []).filter((t) => termOk(t.term));
  const known = new Set(g.terms.map((t) => t.term));
  for (const s of sections) s.terms = s.terms.filter((t) => termOk(t) && known.has(t));

  g.sections = sections;
  g.points = (g.points ?? []).map(plain);
  return { ok: true, guide: g };
}
