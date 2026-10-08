/** 9~13단계 — 분류된 글을 홈 자리별로 고르고 세는 규칙. 기준 문서: docs/02_홈배치기준.md */
import {
  BUCKET_TECHS,
  EXPERIENCES,
  experienceByLabel,
  isInternal,
  PRODUCT_PATTERNS,
  TECH_CATEGORIES,
  type ExperienceKey,
  type ProductPatternKey,
  type TechKey,
} from "../2-classify/taxonomy";
import type { ArticleRow, Classification } from "../shared/types";

/* ───────────── 홈 노출 기준 ─────────────
 * 그룹핑 순서: Problem Taxonomy → Experience → Product Pattern → Article (기술은 1차 기준이 아니다)
 * - 경험 카드 숫자: fit=STRONG 인 글만 센다. 사내 운영·개발 글도 같은 경험·같은 기준으로 센다(카드에 '사내 운영·개발 경험' 태그로만 표시).
 * - fit=WEAK, 보조 경험(secondary)은 경험 페이지의 "함께 볼 글"에만 나온다.
 * - fit=NONE 글은 경험 테마에 나오지 않는다(피드·검색에는 남는다).
 */

export function cls(a: ArticleRow): Classification | null {
  const c = a.learning?.classification;
  if (c) return c;
  // v01 데이터 호환: 예전 단일 라벨을 STRONG·사용자 경험으로 본다
  const k = a.learning ? experienceByLabel(a.learning.experiencePattern) : null;
  if (!k) return null;
  return {
    facts: { problem: "", change: "", technology: "", result: "" },
    burden: null,
    beneficiary: "END_USER",
    interpretation: "",
    fit: "STRONG",
    evidence: "",
    experience: k,
    secondary: [],
    productPattern: null,
    technologies: [],
    articleType: null,
  };
}

export const headlineOf = (a: ArticleRow) => a.learning?.cardHeadline || a.title;
export const internalOf = (a: ArticleRow) => isInternal(cls(a)?.beneficiary);

export type ExperienceStat = {
  key: ExperienceKey;
  total: number;
  user: number;
  internal: number;
  /** 홈 카드에 보여줄 대표 사례 — representative() 기준 */
  example: ArticleRow | null;
  /** 이 경험을 만든 회사 수 */
  companies: number;
  /** 가장 많이 쓴 Product Pattern */
  topPattern: ProductPatternKey | null;
  /** 최근 30일 새 사례 */
  recent: number;
};

/**
 * 경험의 대표 사례 — "우리 사용자에게 어떤 경험을 줄까"를 보는 자리라서
 *   ① 서비스 사용자 경험인 글(+10)
 *   ② 그 경험의 근거가 글 안에 많은 글 — "더 들어가 볼까요?" 칸 중 이 부담으로 매핑되고 실제 결과까지 있는 칸 수(칸당 +2)
 *   ③ 문제 카드 문구가 쉬운 말로 정리된 글(+1)
 * 점수가 같으면 최신 글 (strong 은 이미 최신순).
 */
/**
 * 대표 사례 직접 지정 — 자동 규칙이 분류 오류 때문에 맞지 않는 글을 고를 때 쓴다(글 URL 로 지정).
 * 지정한 글이 그 경험의 STRONG 글이 아니면 무시하고 자동 규칙으로 돌아간다.
 */
// 지금은 지정 없음 — v3 때 "알아서 처리되는"에 무신사 「태블릿을 없애자 생긴 문제」를 지정했으나,
// v4 재분류(2026-10-08) 후 자동 규칙이 「다람쥐」를 고르지 않아 해제했다.
const PINNED_EXAMPLES: Partial<Record<ExperienceKey, string>> = {};

function representative(strong: ArticleRow[], key: ExperienceKey): ArticleRow | null {
  const pinned = strong.find((a) => a.url === PINNED_EXAMPLES[key]);
  if (pinned) return pinned;
  const score = (a: ArticleRow) => {
    const c = cls(a);
    const evidence = (c?.sections ?? []).filter((s) => s.burden === c?.burden && s.result).length;
    return (internalOf(a) ? 0 : 10) + evidence * 2 + (a.learning?.problemCard ? 1 : 0);
  };
  let best: ArticleRow | null = null;
  for (const a of strong) if (!best || score(a) > score(best)) best = a;
  return best;
}

/** 홈 경험 카드 — 글이 많은 경험부터, 글이 없는 경험은 맨 뒤 */
export function experienceStats(rows: ArticleRow[]): ExperienceStat[] {
  return EXPERIENCES.map((key) => {
    const strong = rows.filter((a) => {
      const c = cls(a);
      return c?.experience === key && c.fit === "STRONG";
    });
    const internal = strong.filter(internalOf).length;
    const patterns = new Map<ProductPatternKey, number>();
    for (const a of strong) {
      const p = cls(a)!.productPattern;
      if (p) patterns.set(p, (patterns.get(p) ?? 0) + 1);
    }
    const topPattern = [...patterns.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    const example = representative(strong, key);
    const since = Date.now() - 30 * 864e5;
    return {
      key,
      total: strong.length,
      user: strong.length - internal,
      internal,
      example,
      companies: new Set(strong.map((a) => a.companyId)).size,
      topPattern,
      recent: strong.filter((a) => new Date(a.publishedAt).getTime() >= since).length,
    };
  }).sort((a, b) => b.total - a.total);
}

/** 경험 페이지: 대표(STRONG)는 Product Pattern 별로 묶고, WEAK·보조 경험은 "함께 볼 글" */
export function experienceGroups(rows: ArticleRow[], key: ExperienceKey) {
  const strong = rows.filter((a) => cls(a)?.experience === key && cls(a)?.fit === "STRONG");
  const related = rows.filter((a) => {
    const c = cls(a);
    if (!c || (c.experience === key && c.fit === "STRONG")) return false;
    return (c.experience === key && c.fit === "WEAK") || c.secondary.includes(key);
  });
  const groups: { pattern: ProductPatternKey | null; items: ArticleRow[] }[] = [];
  for (const p of [...PRODUCT_PATTERNS, null]) {
    const items = strong.filter((a) => (cls(a)?.productPattern ?? null) === p);
    if (items.length) groups.push({ pattern: p, items });
  }
  groups.sort((a, b) => (a.pattern === null ? 1 : b.pattern === null ? -1 : b.items.length - a.items.length));
  return { groups, related, total: strong.length };
}

/** "이런 문제를 어떻게 풀었을까요?" — 회사별 최신 글 하나, 부담을 STRONG 으로 덜어준 글만 (사내 글도 같은 기준) */
export function latestProblems(rows: ArticleRow[], limit = 8) {
  const seen = new Set<string>();
  const out: { article: ArticleRow; title: string; summary: string }[] = [];
  for (const r of rows) {
    const c = cls(r);
    if (!r.learning || !c || c.fit !== "STRONG" || seen.has(r.companyId)) continue;
    // 카드 전용 쉬운 문구가 없으면(분류 v3 이전 글) 읽기 가이드의 리드로 대신한다 — 가이드도 쉬운 말로 쓰여 있다
    const card = r.learning.problemCard;
    const lead = r.guide?.lead;
    const title = card?.title ?? headlineOf(r);
    const summary = card?.summary ?? (lead ? [lead.why, lead.soWhat].filter(Boolean).join(" ") : r.learning.quickView.summary[0]);
    if (!summary) continue;
    seen.add(r.companyId);
    out.push({ article: r, title, summary });
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * 홈 "요즘 자주 나오는 기술" — 키워드(기술 분류)마다 관련 글 최신순.
 * 경험으로는 묶지 않는다(경험은 위의 "우리 사용자에게 어떤 경험을 주고 싶나요?"가 맡는다).
 */
export function techExplorer(rows: ArticleRow[], limit = 8, perTech = 4) {
  return techKeywords(rows)
    .slice(0, limit)
    .map(({ tech, total }) => ({ tech, total, articles: articlesForTech(rows, tech).slice(0, perTech) }));
}

/**
 * "요즘 자주 나오는 기술" 키워드 — 최근 글에서 많이 나온 순, 전체 글 수를 함께.
 * 글 매핑 기준은 분류의 technologies(기술 분류)다. 해당 없음 글도 기술은 있으니 포함한다.
 * 기술 이름이 아닌 넓은 바구니(BUCKET_TECHS)는 키워드로 내놓지 않는다.
 */
export function techKeywords(rows: ArticleRow[], recentDays = 120) {
  const since = Date.now() - recentDays * 864e5;
  return TECH_CATEGORIES.filter((tech) => !BUCKET_TECHS.includes(tech)).map((tech) => {
    const items = rows.filter((a) => cls(a)?.technologies.includes(tech));
    const recent = items.filter((a) => new Date(a.publishedAt).getTime() >= since).length;
    return { tech, total: items.length, recent };
  })
    .filter((t) => t.total > 0)
    .sort((a, b) => b.recent - a.recent || b.total - a.total);
}

export const articlesForTech = (rows: ArticleRow[], tech: TechKey) =>
  rows.filter((a) => cls(a)?.technologies.includes(tech));

/** 기술 페이지의 세부 키워드 — 글에 실제로 나온 기술 이름(learning.technology[].name) */
export function techNames(rows: ArticleRow[], limit = 16) {
  const map = new Map<string, Set<number>>();
  for (const a of rows)
    for (const t of a.learning?.technology ?? []) {
      const k = t.name.trim();
      if (!k) continue;
      if (!map.has(k)) map.set(k, new Set());
      map.get(k)!.add(a.id);
    }
  return [...map.entries()]
    .map(([label, ids]) => ({ label, count: ids.size }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit);
}

/** 피드 필터용 태그 집계 */
export function allTags(rows: ArticleRow[], limit = 30) {
  const map = new Map<string, number>();
  for (const r of rows) for (const t of r.learning?.tags ?? []) map.set(t, (map.get(t) ?? 0) + 1);
  return [...map.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
