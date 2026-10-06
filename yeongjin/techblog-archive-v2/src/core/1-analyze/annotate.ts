/** 상세 화면 — 상세 분석의 원문 발췌를 본문에 하이라이트로 얹는다 */
import type { Learning } from "../shared/types";

export type AnnKind = "problem" | "technology" | "experience";

export interface Annotation {
  id: string;
  kind: AnnKind;
  title: string;
  body: string;
  excerpt: string;
}

const MIN_EXCERPT = 8;

/** learning 에서 originalExcerpt 가 붙은 항목을 하이라이트 후보로 모은다 */
export function collectAnnotations(l: Learning): Annotation[] {
  const out: Annotation[] = [];
  l.problem.items.forEach((p, i) =>
    out.push({ id: `p${i}`, kind: "problem", title: p.title, body: p.description, excerpt: p.originalExcerpt }),
  );
  l.technology.forEach((t, i) =>
    out.push({
      id: `t${i}`,
      kind: "technology",
      title: t.name,
      body: `${t.simpleExplanation} ${t.plannerExplanation}`.trim(),
      excerpt: t.originalExcerpt,
    }),
  );
  l.experienceImpact.forEach((e, i) =>
    out.push({
      id: `e${i}`,
      kind: "experience",
      title: e.uxImpact,
      body: `${e.capability} — ${e.description}`,
      excerpt: e.originalExcerpt,
    }),
  );
  return out;
}

const GAP = String.raw`(?:\s|&nbsp;|&#160;|<[^>]*>)*`;

function charPattern(ch: string): string {
  switch (ch) {
    case "&": return "(?:&amp;|&)";
    case "<": return "&lt;";
    case ">": return "&gt;";
    case '"': return '(?:"|&quot;|&#34;)';
    case "'": return "(?:'|&#39;|&#x27;|&apos;)";
    case "’": return "(?:’|&rsquo;)";
    case "“": return "(?:“|&ldquo;)";
    case "”": return "(?:”|&rdquo;)";
    default: return ch.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
  }
}

/** 공백 차이·태그 끼어듦을 모두 허용하는 정규식 */
function excerptRegex(excerpt: string): RegExp | null {
  const chars = [...excerpt.replace(/\s+/g, "")];
  if (chars.length < MIN_EXCERPT) return null;
  return new RegExp(chars.map(charPattern).join(GAP), "g");
}

/** 발췌문이 원문 HTML 에 (공백·태그 차이를 허용하고) 실제로 있는가 */
export function excerptExists(html: string, excerpt: string): boolean {
  const re = excerptRegex(excerpt ?? "");
  if (!re) return false;
  for (let m = re.exec(html); m; m = re.exec(html)) if (!insideTag(html, m.index)) return true;
  return false;
}

function insideTag(html: string, index: number): boolean {
  const lt = html.lastIndexOf("<", index - 1);
  const gt = html.lastIndexOf(">", index - 1);
  return lt > gt;
}

/** 매칭 구간의 텍스트 조각만 <mark> 로 감싼다 (태그 경계를 넘어도 HTML 구조가 깨지지 않게) */
function wrap(fragment: string, a: Annotation): string {
  return fragment.replace(/([^<]+)|(<[^>]*>)/g, (m, text: string | undefined) =>
    text && text.trim()
      ? `<mark class="ann ann-${a.kind}" data-ann="${a.id}">${text}</mark>`
      : m,
  );
}

export function annotateHtml(html: string, anns: Annotation[]): { html: string; missed: Annotation[] } {
  let out = html;
  const missed: Annotation[] = [];
  for (const a of anns) {
    const re = excerptRegex(a.excerpt ?? "");
    if (!re) {
      missed.push(a);
      continue;
    }
    let found: RegExpExecArray | null = null;
    for (let m = re.exec(out); m; m = re.exec(out)) {
      if (!insideTag(out, m.index) && !out.slice(m.index, m.index + m[0].length).includes("data-ann=")) {
        found = m;
        break;
      }
      if (m[0].length === 0) re.lastIndex++;
    }
    if (!found) {
      missed.push(a);
      continue;
    }
    // 같은 문장이 여러 번 나와도 첫 매칭 한 곳만
    out = out.slice(0, found.index) + wrap(found[0], a) + out.slice(found.index + found[0].length);
  }
  return { html: out, missed };
}
