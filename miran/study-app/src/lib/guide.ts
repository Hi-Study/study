/**
 * 읽기 가이드 — 글을 **1분 안에 파악**하게 만드는 층(스키마 §33).
 *
 * v1 은 원문을 단계로 쪼개 접었다 펴는 구조였다. 버렸다 —
 * 자르기만 해서는 안 쉬워진다. 어려운 건 문단 길이가 아니라 **문장 자체**였고,
 * 열면 결국 원문 그대로라 원래 난이도로 돌아갔다.
 *
 * v2 는 "핵심 정리 = 시간순 한 줄씩"이었다. 이것도 버렸다 —
 * 실제로 나온 줄이 "원천 데이터에 메타데이터를 붙여 임베딩을 만든다" 같은 것이었다.
 * 그건 **개발자가 한 일의 순서**지, 비개발자가 알아야 할 내용이 아니다.
 * 게다가 "조금 더 자세히"가 리드에 없던 개념을 소제목으로 들고 나와 길을 잃게 만들었다.
 *
 * v3 은 뉴스 다이제스트가 실제로 쓰는 틀이다:
 *   ① 알아두면 편해요(용어)
 *   ② 한눈에 — **어떤 문제 / 왜 풀어야 했나 / 뭘 했나 / 그래서 뭐가 달라졌나** 네 질문
 *   ③ 기획 포인트 — 기획자가 이 글을 어떤 눈으로 볼 것인가(없으면 숨긴다)
 *   ④ 더 들어가 볼까요 — 칸마다 **질문 → 문제 → 해결 → 그래서 어떻게 됐나 → 원문**
 *   ⑤ 원문은 칸마다 눌러서 확인한다
 *
 * 대가가 있다. AI 가 사실을 틀리면 **그대로 전달된다.** 그래서:
 *   · 숫자·고유명사는 원문에 글자 그대로 있는 것만 통과시킨다(서버 게이트)
 *   · 칸마다 원문 어느 블록에서 나왔는지 함께 저장한다 → 눌러서 확인할 수 있다
 *   · 못 만들면 저장하지 않는다. 화면은 요약 없이 원문 보기로 간다
 */
import type { GuideLead, GuideSection, ReadingGuide } from "@/types/database";

function str(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

/**
 * 근거 블록 목록. `blocks` 가 정본이고, 옛 저장본의 단일 `block` 도 받아 준다.
 * 음수·중복은 버린다 — 화면에서 같은 문단이 두 번 펼쳐지면 근거가 많아 보이는 착시가 생긴다.
 */
function blockList(raw: unknown, legacy: unknown): number[] {
  const src = Array.isArray(raw) ? raw : legacy != null ? [legacy] : [];
  const out: number[] = [];
  for (const v of src) {
    const n = Number(v);
    if (Number.isFinite(n) && n >= 0 && !out.includes(Math.floor(n))) out.push(Math.floor(n));
    if (out.length >= 4) break;
  }
  return out;
}

/**
 * jsonb → ReadingGuide. 쓸 수 있는 게 하나도 없으면 null.
 * DB 에서 온 값은 무엇이든 올 수 있다고 보고 **전부 여기서** 정규화한다 —
 * 화면마다 방어 코드를 쓰면 규칙이 여러 벌이 된다.
 *
 * ⚠️ v2 로 저장된 옛 가이드(`points`/`details`)는 여기서 null 이 된다.
 *    그게 맞다 — 화면은 "값이 있나"가 아니라 "읽을 수 있나"로 판단해 다시 만든다.
 */
export function toReadingGuide(raw: unknown): ReadingGuide | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Partial<ReadingGuide>;

  const rawLead = (r.lead ?? {}) as Partial<GuideLead>;
  const lead: GuideLead = {
    what: str(rawLead.what),
    why: str(rawLead.why),
    how: str(rawLead.how),
    soWhat: str(rawLead.soWhat),
  };

  const sections: GuideSection[] = Array.isArray(r.sections)
    ? r.sections
        .map((s) => {
          const o = (s ?? {}) as Partial<GuideSection> & { block?: unknown };
          return {
            question: str(o.question),
            problem: str(o.problem),
            paras: Array.isArray(o.paras) ? o.paras.map(str).filter(Boolean).slice(0, 5) : [],
            outcome: str(o.outcome),
            blocks: blockList(o.blocks, o.block),
            terms: Array.isArray(o.terms) ? o.terms.map(str).filter(Boolean).slice(0, 3) : [],
          };
        })
        // 문제만 있고 해결이 없어도 칸은 살린다 — 문제를 아는 것만으로도 읽을 값이 있다.
        .filter((s) => s.question.length > 0 && (s.paras.length > 0 || s.problem.length > 0))
        .slice(0, 5)
    : [];

  const terms = Array.isArray(r.terms)
    ? r.terms
        .map((t) => {
          const o = (t ?? {}) as { term?: unknown; plain?: unknown };
          return { term: str(o.term), plain: str(o.plain) };
        })
        .filter((t) => t.term.length > 0 && t.plain.length > 0)
        .slice(0, 8)
    : [];

  const guide: ReadingGuide = {
    summary: str(r.summary),
    terms,
    lead,
    plannerPoint: str(r.plannerPoint),
    sections,
  };
  // 리드가 없으면 이 가이드는 읽을 수 없다 — 용어만 남은 가이드는 글을 설명하지 못한다.
  if (!hasLead(guide)) return null;
  return guide;
}

/**
 * "한눈에" 칸을 띄울 만한가.
 * 네 질문 중 **문제**는 반드시 있어야 하고, 나머지 셋 중 하나는 채워져 있어야 한다.
 * 한 칸짜리 리드는 제목의 반복이지 설명이 아니다.
 */
export function hasLead(guide: ReadingGuide | null): boolean {
  if (!guide) return false;
  const { what, why, how, soWhat } = guide.lead;
  return (
    what.length >= 10 && (why.length >= 10 || how.length >= 10 || soWhat.length >= 10)
  );
}

/** 리드에서 실제로 채워진 칸만 — 빈 칸은 그리지 않는다. */
export function leadRows(guide: ReadingGuide): { q: string; a: string }[] {
  const rows: { q: string; a: string }[] = [];
  // ⚠️ 라벨은 **그 칸이 실제로 담는 것**을 물어야 한다.
  //    "무슨 일이에요?"로 묻고 문제를 답하게 했더니, 읽는 사람이 "사건은 언제 나오지?"
  //    하고 결론을 기다리게 됐다(실제로 받은 지적). 질문을 내용에 맞춘다.
  if (guide.lead.what) rows.push({ q: "어떤 문제가 있었어요?", a: guide.lead.what });
  if (guide.lead.why) rows.push({ q: "왜 풀어야 했대요?", a: guide.lead.why });
  if (guide.lead.how) rows.push({ q: "뭘 했대요?", a: guide.lead.how });
  if (guide.lead.soWhat) rows.push({ q: "그래서 뭐가 달라졌어요?", a: guide.lead.soWhat });
  return rows;
}

/**
 * 기획 포인트를 띄울 만한가.
 * 한 문장도 안 되는 길이면 안 띄운다 — "참고할 만해요" 같은 말은 아무것도 말하지 않는다.
 */
export function hasPlannerPoint(guide: ReadingGuide | null): boolean {
  return !!guide && guide.plannerPoint.length >= 20;
}

/** "더 들어가 볼까요" 칸을 띄울 만한가 — 짧은 글은 없는 게 정상이다. */
export function hasSections(guide: ReadingGuide | null): boolean {
  return !!guide && guide.sections.length >= 1;
}

/** 읽기 전 용어 칸을 띄울 만한가. */
export function hasTerms(guide: ReadingGuide | null): boolean {
  return !!guide && guide.terms.length >= 1;
}

/**
 * 문장 안에서 **용어가 나오는 자리**를 찾아 조각으로 쪼갠다.
 *
 * 개발을 모르는 사람이 막히는 단어에만 밑줄을 긋기 위한 것이다. 예전에는 문장을 길게 눌러
 * 그 안의 단어를 직접 고르게 했는데, **어떤 단어가 어려운지 아는 사람만** 쓸 수 있는 방식이었다.
 * 이제 어려운 단어를 먼저 골라 표시해두고, 누르면 뜻이 뜬다.
 *
 * 긴 용어부터 찾는다 — "AB 테스트"가 있는데 "AB"만 잡으면 엉뚱한 곳이 끊긴다.
 */
export function splitByTerms(
  text: string,
  terms: string[],
): { text: string; term: string | null }[] {
  const list = [...new Set(terms.filter((t) => t.length >= 2))].sort((a, b) => b.length - a.length);
  if (list.length === 0) return [{ text, term: null }];

  const out: { text: string; term: string | null }[] = [];
  let rest = text;
  let guard = 0;
  while (rest.length > 0 && guard++ < 200) {
    let hitAt = -1;
    let hitTerm = "";
    for (const t of list) {
      const i = rest.indexOf(t);
      if (i >= 0 && (hitAt < 0 || i < hitAt)) {
        hitAt = i;
        hitTerm = t;
      }
    }
    if (hitAt < 0) {
      out.push({ text: rest, term: null });
      break;
    }
    if (hitAt > 0) out.push({ text: rest.slice(0, hitAt), term: null });
    out.push({ text: hitTerm, term: hitTerm });
    rest = rest.slice(hitAt + hitTerm.length);
  }
  if (guard >= 200 && rest.length > 0) out.push({ text: rest, term: null });
  return out;
}
