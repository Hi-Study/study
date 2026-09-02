// AI 요약 모드 — 공유/토론 공통 + distill 아티클 3관점(insight).
export type SummaryMode = "plain" | "planner" | "explain" | "insight";

export const SUMMARY_MODES: { key: SummaryMode; label: string; hint: string }[] = [
  { key: "plain", label: "원문 요약", hint: "핵심만 압축" },
  { key: "planner", label: "기획자 관점", hint: "기획자가 볼 포인트" },
  { key: "explain", label: "쉽게 풀기", hint: "쉬운 말로" },
];

export type SummaryMap = Partial<Record<SummaryMode, string>>;

// distill 글 상세 "AI 요약 3관점" — 무슨 문제 / 어떻게 해결 / 디자이너·PM 관점 배울 점.
export interface InsightSection {
  title: string;
  body: string;
}

/**
 * 3관점 요약의 세 번째 제목은 **읽는 사람 직무에 따라 달라진다**(온보딩에서 받은 job_role).
 * 같은 글이라도 기획자에게는 판단 과정이, 개발자에게는 구현이 남을 것이 다르기 때문이다.
 * 앞의 두 제목은 고정 — 파싱 기준이자 "문제 → 해결"이라는 뼈대라서 바뀌면 안 된다.
 */
export const ROLE_INSIGHT_TITLE: Record<string, string> = {
  planner: "기획자 관점에서 배울 점",
  designer: "디자이너 관점에서 배울 점",
  marketer: "마케터 관점에서 배울 점",
  dev: "개발자 관점에서 배울 점",
  data: "데이터 관점에서 배울 점",
  other: "실무에 적용할 점",
};

/** 직무별 세 번째 제목(모르는 값이면 기존 기본 제목). */
export function insightTitleForRole(jobRole: string | null | undefined): string {
  return ROLE_INSIGHT_TITLE[jobRole ?? ""] ?? "디자이너·PM 관점에서 배울 점";
}

/**
 * ai_summaries 캐시 키 — 직무별 요약이 서로 덮어쓰지 않게 분리한다.
 * 직무가 없으면 기존 키("insight")를 그대로 써서 예전 캐시를 살린다.
 */
export function insightCacheKey(jobRole: string | null | undefined): string {
  return jobRole ? `insight_${jobRole}` : "insight";
}

/** 3관점 요약이 기대하는 표준 제목(프롬프트와 동일). 세 번째는 직무별로 대체될 수 있다. */
export const INSIGHT_TITLES = [
  "무슨 문제를 다뤘나",
  "어떻게 해결했나",
  "디자이너·PM 관점에서 배울 점",
] as const;

/**
 * insight 요약 텍스트가 '3관점 구조'인지 판별.
 * '### 제목' 마커가 있거나, 표준 제목이 2개 이상 등장하면 구조화된 것으로 본다.
 * (구형/폴백으로 저장된 단일 요약을 걸러내 화면에서 재생성을 유도하기 위함.)
 */
export function isStructuredInsight(text: string | null | undefined): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  if (/^\s{0,3}#{1,3}\s+/m.test(t)) return true;
  // 세 번째 제목은 직무별로 다르므로 후보 전체를 놓고 센다.
  const candidates = [...INSIGHT_TITLES, ...Object.values(ROLE_INSIGHT_TITLE)];
  const hit = candidates.filter((title) => t.includes(title)).length;
  return hit >= 2;
}

/**
 * insight 요약 텍스트를 제목 기준으로 섹션으로 쪼갠다.
 * '### 제목'(또는 #/##) 마커를 우선 쓰고, 마커가 없으면 표준 제목 위치로 분할한다.
 * 어떤 구조도 못 찾으면 통째로 한 섹션으로 반환. 순수 — 테스트 대상.
 */
export function splitInsightSections(text: string): InsightSection[] {
  const t = (text ?? "").trim();
  if (!t) return [];

  // 1) 마크다운 헤더(#, ##, ###)가 있으면 그걸로 분할.
  if (/^\s{0,3}#{1,3}\s+/m.test(t)) {
    return t
      .split(/^\s{0,3}#{1,3}\s+/m)
      .map((s) => s.trim())
      .filter(Boolean)
      .map(toSection);
  }

  // 2) 마커는 없지만 표준 제목이 본문에 박혀 있으면 그 위치로 분할.
  const found = [...INSIGHT_TITLES, ...Object.values(ROLE_INSIGHT_TITLE)].filter((title) => t.includes(title));
  if (found.length >= 2) {
    const escaped = [...INSIGHT_TITLES, ...Object.values(ROLE_INSIGHT_TITLE)].map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|");
    return t
      .split(new RegExp(`(?=(?:${escaped}))`))
      .map((s) => s.trim())
      .filter(Boolean)
      .map((seg) => {
        // 세그먼트 앞의 표준 제목을 떼어내 title 로, 나머지를 body 로.
        const title = [...INSIGHT_TITLES, ...Object.values(ROLE_INSIGHT_TITLE)].find((tt) => seg.startsWith(tt));
        if (title) {
          return { title, body: seg.slice(title.length).replace(/^[\s:：·-]+/, "").trim() };
        }
        return toSection(seg);
      });
  }

  // 3) 구조 없음 — 통째로 한 섹션.
  return [{ title: "AI 요약", body: t }];
}

function toSection(p: string): InsightSection {
  const nl = p.indexOf("\n");
  if (nl === -1) {
    // 제목만 있는 줄인지, 제목: 본문 형태인지 구분.
    const colon = p.indexOf(":");
    if (colon > 0 && colon < 30) return { title: p.slice(0, colon).trim(), body: p.slice(colon + 1).trim() };
    return { title: p.trim(), body: "" };
  }
  return { title: p.slice(0, nl).trim().replace(/[:：]\s*$/, ""), body: p.slice(nl + 1).trim() };
}
