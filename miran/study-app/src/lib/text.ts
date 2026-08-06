// 링크 원문 텍스트에서 화면에 불필요한 잡음(사이트 꼬리: 푸터·저작권·회사정보·UI)을 걷어낸다.
// 서버(Edge extract.ts)에서 1차로 걸러도, 예전에 저장된 글은 잡음이 섞여 있을 수 있어
// 화면 표시 직전에 한 번 더 통과시킨다.
//
// ⚠️ 반드시 "꼬리에서만" 제거한다. 본문 중간을 자르면 글이 통째로 사라지므로(과거 버그),
//    길이 60자 초과의 "진짜 문장"을 만나면 즉시 멈춘다.

const FOOTER_RE =
  /(사업자\s*등록\s*번호|통신판매업|대표\s*이사|고객\s*(센터|문의)|개인정보\s*처리방침|이용약관|청소년보호정책|저작권|무단\s*전재|재배포\s*금지|Copyright|All\s+rights\s+reserved|구독|공유하기|이전\s*글|다음\s*글|연관\s*기사|관련\s*기사|©|ⓒ)/i;

/** 본문 꼬리에 딸려온 사이트 푸터/UI 잡음만 안전하게 제거(본문 중간은 절대 안 자름). */
export function stripArticleNoise(text: string): string {
  if (!text) return "";
  const lines = text.split("\n");
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i].trim();
    if (ln.length > 60 && !FOOTER_RE.test(ln)) {
      end = i + 1;
      break;
    }
  }
  // 기준 문장을 못 찾으면(전부 짧은 줄) 원문 보존 — 본문을 통째로 날리지 않는다.
  return end < 0 ? text.trim() : lines.slice(0, end).join("\n").trim();
}

/** 저장된 본문이 "옛 방식의 잡음 덩어리"인지 판단 → 자동 재수집 트리거용. */
export function looksLikeStaleArticle(text: string | null | undefined): boolean {
  if (!text) return false;
  // 새 추출기는 이런 사이트 꼬리를 남기지 않는다. 남아 있으면 옛 저장본.
  return /(사업자\s*등록\s*번호|통신판매업|청소년보호정책|이용약관|고객\s*문의)/.test(text);
}

/**
 * 본문을 문장 단위 조각으로 나눈다(하이라이트 앵커용).
 * - 문장 끝(. ! ?) 또는 줄바꿈 뒤에서 분할하고, 구분자·공백을 그대로 유지한다.
 * - 조각들을 이어 붙이면 원문과 정확히 같다(join("") === text). 모든 클라에서 동일한 순번.
 */
export function splitSentences(text: string): string[] {
  if (!text) return [];
  const parts = text.match(/[^.!?\n]*(?:[.!?]+|\n+|$)/g) ?? [text];
  return parts.filter((p) => p.length > 0);
}

/**
 * 표시 직전 본문 정제 — 수집 때 걸러지지 못하고 남은 HTML 태그(<p>·<div> 등)와 과잉 빈 줄 제거.
 * ⚠️ 문장 인덱스(하이라이트) 안정성을 위해 표시·하이라이트가 반드시 "같은 정제본"을 써야 한다.
 *    수학식의 'a < b' 는 남기도록 <태그>(글자로 시작) 패턴만 제거.
 */
export function cleanBody(text: string | null | undefined): string {
  if (!text) return "";
  return text
    .replace(/<\/?[a-zA-Z][^>]*>/g, "") // 남은 열림/닫힘 태그
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** 예상 읽기 시간(분) — 한국어 기술글 기준 약 600자/분. 정제본 길이로 계산. */
export function readingMinutes(text: string | null | undefined): number | null {
  const clean = cleanBody(text);
  if (!clean) return null;
  return Math.max(1, Math.round(clean.length / 600));
}

/** URL 에서 표시용 도메인만 뽑는다(www. 제거). 실패 시 원본 반환. */
export function domainOf(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").split("/")[0] || url;
  }
}
