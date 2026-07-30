// 온디바이스(앱) 원문 추출 — 서버(Edge)가 Cloudflare 데이터센터 IP 차단으로 본문을
// 못 가져올 때(우아한형제들 등), 폰(일반 IP)에서 직접 원문을 받아 본문을 뽑는다.
// 서버 supabase/functions/_shared/extract.ts 와 동일한 휴리스틱(정규식)을 사용해
// 문장 순번(splitSentences)이 서버 캐시본과 어긋나지 않게 한다.

const CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php); kakaotalk-scrap/1.0";

export interface ExtractedArticle {
  text: string | null;
  image: string | null;
  excerpt: string | null;
}

function metaContent(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  return html.match(re)?.[1] ?? null;
}

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

function htmlToText(html: string): string {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|section|article|tr|blockquote)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

function grabByAttr(html: string, attrRe: string): string | null {
  const open = new RegExp(
    `<([a-z0-9]+)([^>]*\\b(?:id|class)=["'][^"']*${attrRe}[^"']*["'][^>]*)>`,
    "i",
  );
  const m = html.match(open);
  if (!m || m.index === undefined) return null;
  const tag = m[1].toLowerCase();
  const opener = new RegExp(`<${tag}\\b`, "ig");
  const closer = new RegExp(`</${tag}>`, "ig");
  let i = m.index + m[0].length;
  let depth = 1;
  let guard = 0;
  while (depth > 0 && guard++ < 5000) {
    closer.lastIndex = i;
    const c = closer.exec(html);
    if (!c) break;
    opener.lastIndex = i;
    let o: RegExpExecArray | null;
    let opens = 0;
    while ((o = opener.exec(html)) && o.index < c.index) opens++;
    depth += opens - 1;
    i = c.index + c[0].length;
  }
  return html.slice(m.index + m[0].length, i);
}

const SITE_SELECTORS = [
  "dic_area",
  "newsct_article",
  "articleBodyContents",
  "article_body_contents",
  "news_end",
  "art_body",
];

const FOOTER_RE =
  /(사업자\s*등록\s*번호|통신판매업|대표\s*이사|고객\s*(센터|문의)|개인정보\s*처리방침|이용약관|청소년보호정책|저작권|무단\s*전재|재배포\s*금지|Copyright|All\s+rights\s+reserved|구독|공유하기|이전\s*글|다음\s*글|연관\s*기사|관련\s*기사|©|ⓒ)/i;

function stripFooter(text: string): string {
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
  return end < 0 ? text.trim() : lines.slice(0, end).join("\n").trim();
}

export function extractArticle(html: string): ExtractedArticle {
  const image = metaContent(html, "og:image");
  const excerpt = metaContent(html, "og:description") ?? metaContent(html, "description");
  let text = "";

  for (const sel of SITE_SELECTORS) {
    const inner = grabByAttr(html, sel);
    if (inner) {
      const t = stripFooter(htmlToText(inner));
      if (t.length >= 200) {
        text = t;
        break;
      }
    }
  }

  if (!text) {
    const ps = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => ({ raw: m[1], t: htmlToText(m[1]) }))
      .filter((p) => p.t.length >= 40 && (p.raw.match(/<a\b/gi) ?? []).length <= 1)
      .map((p) => p.t);
    if (ps.join("\n").length >= 300) text = stripFooter(ps.join("\n"));
  }

  if (!text) {
    const regions = [
      ...html.matchAll(/<article[\s\S]*?<\/article>/gi),
      ...html.matchAll(/<main[\s\S]*?<\/main>/gi),
    ].map((m) => m[0]);
    let best = "";
    for (const r of regions) {
      const t = htmlToText(r);
      if (t.length > best.length) best = t;
    }
    if (best.length >= 400) text = stripFooter(best);
  }

  return { text: text.length > 150 ? text : null, image, excerpt };
}

/** 폰에서 직접 원문을 받아 본문을 추출한다(서버가 차단당했을 때의 폴백). */
export async function fetchArticleOnDevice(url: string): Promise<ExtractedArticle> {
  const res = await fetch(url, {
    headers: {
      "User-Agent": CRAWLER_UA,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  const html = await res.text();
  return extractArticle(html);
}
