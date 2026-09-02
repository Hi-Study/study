// 본문 용어 풀이(articles.terms) 유틸.
//
// 수집할 때 AI 배치가 글마다 [{term, plain, why, domain}] 을 채워 둔다.
// 사용자가 단어를 누르면 여기서 그 단어의 영역(domain)을 찾아 단어장에 함께 저장한다
// → 누른 기록이 쌓여 "내가 자주 막히는 영역"이 된다.
//
// ⚠️ 이건 비개발자 전용이 아니다. 개발자가 '리텐션·코호트·LTV' 를 누르면 대칭으로 작동한다.
import type { ArticleTerm } from "@/types/database";

/** DB(jsonb)나 unknown 값을 ArticleTerm[] 으로 안전 변환(형식이 안 맞는 항목은 버린다). */
export function toTerms(raw: unknown): ArticleTerm[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((r) => {
      if (!r || typeof r !== "object") return null;
      const t = r as Partial<ArticleTerm>;
      const term = typeof t.term === "string" ? t.term.trim() : "";
      if (!term) return null;
      return {
        term,
        plain: typeof t.plain === "string" ? t.plain.trim() : "",
        why: typeof t.why === "string" ? t.why.trim() : "",
        domain: typeof t.domain === "string" ? t.domain.trim() : "",
      };
    })
    .filter((t): t is ArticleTerm => t !== null);
}

const norm = (s: string): string => s.toLowerCase().replace(/[\s·・_-]/g, "");

/**
 * 누른 단어의 영역을 찾는다. 정확히 같거나, 한쪽이 다른 쪽을 포함하면 같은 용어로 본다
 * (본문은 "카나리 배포"인데 사용자가 "카나리"만 누르는 경우가 흔하다).
 * 못 찾으면 null — 단어는 그대로 저장되고 영역만 비어 있다.
 */
export function termDomain(raw: unknown, term: string): string | null {
  const t = norm(term ?? "");
  if (!t) return null;
  for (const row of toTerms(raw)) {
    if (!row.domain) continue;
    const r = norm(row.term);
    if (r === t || r.includes(t) || t.includes(r)) return row.domain;
  }
  return null;
}

/** 글에 용어가 몇 개 있는지 — 상단 "이 글에 용어 N개 있어요" 예고용. */
export function termCount(raw: unknown): number {
  return toTerms(raw).length;
}

/** 본문에서 풀이가 준비된 용어만(글 상단 예고 칩에 쓸 목록). */
export function termList(raw: unknown, limit = 6): ArticleTerm[] {
  return toTerms(raw)
    .filter((t) => t.plain.length > 0)
    .slice(0, limit);
}
