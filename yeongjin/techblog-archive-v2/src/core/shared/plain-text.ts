/**
 * 누구나 읽는 문구 검사 — 제목 문장(1-analyze/headline)과 홈 문제 카드(2-classify)가 같이 쓴다.
 * 기준 문서: docs/01_분류기준.md "제목 문장" · 8단계 공통 규칙
 */

export const JARGON =
  /파이프라인|아키텍처|비동기|렌더링|임베딩|캐시|스레드|인프라|리팩터링|마이그레이션|레이턴시|오케스트레이션|프레임워크|컴포넌트|트래픽|쿼리|지오코딩|형상관리|디컴파일|커밋|브랜치|엔드포인트|스키마|로깅|번들/;
export const ALLOWED_LATIN = new Set(["AI", "QR", "PDF", "SNS", "PC", "TV", "OK"]);

/** 영어 단어(허용 목록 밖)·개발 용어만 본다. 통과하면 null, 아니면 이유 */
export function jargonProblem(h: string): string | null {
  const t = (h ?? "").trim();
  const latin = (t.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !ALLOWED_LATIN.has(w.toUpperCase()));
  if (latin.length) return `영어 용어: ${latin.join(", ")}`;
  const j = t.match(JARGON);
  return j ? `개발 용어: ${j[0]}` : null;
}

/** 길이, "~요" 끝, 영어·개발 용어 금지, 숫자는 원문에 있는 것만. 통과하면 null, 아니면 이유 */
export function plainTextProblem(h: string, sourceText: string, min: number, max: number): string | null {
  const t = (h ?? "").trim();
  if (t.length < min || t.length > max) return `길이 ${t.length}자 (${min}~${max}자)`;
  if (!/요[.!?]?$/.test(t)) return "'~요'로 끝나지 않음";
  const jp = jargonProblem(t);
  if (jp) return jp;
  // 숫자는 단위까지 같이 원문에 있어야 한다 ("12분" ≠ 원문의 "12개")
  const flat = sourceText.replace(/\s+/g, "");
  const bad = [...t.matchAll(/(\d+(?:[.,]\d+)*)\s*([가-힣%])?/g)]
    .map((m) => m[1] + (m[2] ?? ""))
    .filter((n) => !flat.includes(n));
  if (bad.length) return `원문에 없는 숫자: ${bad.join(", ")}`;
  return null;
}
