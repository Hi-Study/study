/**
 * 히어로 한 줄 요약 다듬기.
 *
 * 수집한 요약(`articles.summary`)은 RSS·og:description 에서 온 것이라 대개
 * **본문 첫 문단을 글자 수로 자른 것**이다. 그래서 그대로 쓰면
 *   "… UI 개선과 다양한 신규 기능.."
 * 처럼 말이 끊긴 채 점만 남는다. 요약처럼 보이지 않고 고장처럼 보인다.
 *
 * 그래서 **문장 단위로** 자른다: 끝난 문장만 모으고, 끝나지 않은 꼬리는 버린다.
 * 온전한 문장이 하나도 없으면(=원문이 이미 잘려 왔으면) 그 조각을 쓰되
 * 꼬리의 점들을 정리하고 말줄임표 하나로 맺는다.
 *
 * ⚠️ 이건 AI 요약이 아니다. 가이드(reading_guide.summary)가 생기면 그쪽이 우선이고,
 *    이건 아직 요약이 없는 글에서 제목만 덩그러니 남지 않게 하는 폴백이다.
 */

function stripTags(raw: string): string {
  return raw
    .replace(/<\/?[a-zA-Z][^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"');
}

/** 꼬리에 남은 점·말줄임표·"더보기" 같은 잔재를 걷어낸다. */
function trimTail(s: string): string {
  return s
    .replace(/\s*(더\s*보기|더보기|read\s*more|계속\s*읽기)\s*$/i, "")
    .replace(/[.\u2026]+\s*$/u, "")
    .trim();
}

/**
 * 문장이 **끝난 자리**의 인덱스들.
 *
 * 마침표라고 다 문장 끝이 아니다. 두 가지를 빼야 한다:
 *   · 버전·소수점 — "Airflow 2.10.2" 의 점(숫자 사이)
 *   · 말줄임 — ".." "..." 은 원문이 잘렸다는 표시지 문장 끝이 아니다
 * 그리고 뒤가 공백이나 문장 끝이어야 한다("www.naver.com" 같은 걸 자르지 않게).
 */
function sentenceEnds(text: string): number[] {
  const ends: number[] = [];
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== "." && ch !== "!" && ch !== "?" && ch !== "。") continue;
    const prev = text[i - 1] ?? "";
    const next = text[i + 1] ?? "";
    if (ch === "." && /\d/.test(prev) && /\d/.test(next)) continue; // 2.10.2
    if (ch === "." && (next === "." || prev === ".")) continue; // .. ...
    if (next === "" || /\s/.test(next)) ends.push(i);
  }
  return ends;
}

export function summaryLine(raw: string | null | undefined, max = 140): string {
  if (!raw) return "";
  const text = stripTags(raw).replace(/\s+/g, " ").trim();
  if (!text) return "";

  // 끝난 문장만 차례로 모은다. 잘려 온 꼬리는 문장 끝이 없으므로 자연히 빠진다.
  let out = "";
  let from = 0;
  for (const end of sentenceEnds(text)) {
    const piece = text.slice(from, end + 1).trim();
    from = end + 1;
    if (!piece) continue;
    if (out.length + piece.length + 1 > max) break;
    out = out ? `${out} ${piece}` : piece;
  }

  if (out) return out;

  // 온전한 문장이 없다 = 원문이 이미 잘려 왔다. 조각을 쓰되 깔끔하게 맺는다.
  const head = trimTail(text.slice(0, max));
  return head ? `${head}…` : "";
}
