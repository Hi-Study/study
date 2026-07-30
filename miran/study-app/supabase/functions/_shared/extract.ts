// 링크 원문에서 "읽을 수 있는 본문"을 추출한다.
// ⚠️ Deno Deploy 에서 canvas 네이티브 모듈 번들 실패를 피하려고 DOM 라이브러리를
//    쓰지 않고, 순수 문자열(정규식) 휴리스틱으로 본문을 뽑는다.
//
// 전략(실측으로 검증):
//  1) 사이트 표준 본문 컨테이너(#dic_area 등) 우선 — 네이버 등 <p> 안 쓰는 곳 대응
//  2) 시맨틱 영역(<article>/<main>) 중 텍스트가 가장 긴 것
//  3) 문단 밀도: 실제 문장이 담긴 <p> 만 모음 — 대부분 사이트의 범용 해법
//  그리고 footer 는 "꼬리에서만" 안전하게 제거(본문 중간은 절대 자르지 않음).
export interface Extracted {
  title: string | null;
  text: string | null; // 본문 평문
  excerpt: string | null; // 짧은 설명(og_description 대체)
  image: string | null; // og:image
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
  // 블록 태그 종료 → 줄바꿈
  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|section|article|tr|blockquote)>/gi, "\n");
  // 남은 태그 제거
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  // 줄 단위 정리
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

// id/class 값에 attrRe(부분 문자열)를 포함하는 여는 태그를 찾아,
// 같은 태그의 중첩을 세며 균형 잡힌 내부 HTML 을 반환한다.
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

// "정밀" 본문 컨테이너만(주로 <br> 기반 언론사 본문). 넓은 래퍼(entry/post-content 등)는
// 목차·GNB 까지 삼켜 잡음이 되므로 제외하고, 그런 사이트는 문단밀도 경로로 처리한다.
const SITE_SELECTORS = [
  "dic_area", // 네이버 뉴스
  "newsct_article",
  "articleBodyContents",
  "article_body_contents",
  "news_end",
  "art_body",
];

// 본문에는 거의 없는 "사이트 꼬리(푸터/UI)" 신호.
const FOOTER_RE =
  /(사업자\s*등록\s*번호|통신판매업|대표\s*이사|고객\s*(센터|문의)|개인정보\s*처리방침|이용약관|청소년보호정책|저작권|무단\s*전재|재배포\s*금지|Copyright|All\s+rights\s+reserved|구독|공유하기|이전\s*글|다음\s*글|연관\s*기사|관련\s*기사|©|ⓒ)/i;

/**
 * 꼬리(끝)에서부터만 푸터/UI 잡음 줄을 걷어낸다.
 * 길이 60자 초과이면서 푸터 신호가 없는 "진짜 문장"을 만나면 즉시 멈춘다 →
 * 본문 중간은 절대 잘리지 않는다.
 */
export function stripFooter(text: string): string {
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

export function extractArticle(html: string): Extracted {
  const image = metaContent(html, "og:image");
  const excerpt =
    metaContent(html, "og:description") ?? metaContent(html, "description");

  let text = "";

  // 1) 사이트 표준 본문 컨테이너
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

  // 2) 문단 밀도: 실제 문장이 담긴 <p> 만 모음(블로그 범용 — 목차/GNB/사이드바 자동 배제)
  if (!text) {
    const ps = [...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)]
      .map((m) => ({ raw: m[1], t: htmlToText(m[1]) }))
      // 40자 이상 문장 + 링크(<a>) 1개 이하 → 메뉴/목차/각주 링크 뭉치 배제
      .filter((p) => p.t.length >= 40 && (p.raw.match(/<a\b/gi) ?? []).length <= 1)
      .map((p) => p.t);
    if (ps.join("\n").length >= 300) text = stripFooter(ps.join("\n"));
  }

  // 3) 시맨틱 영역(<article>/<main>) 중 텍스트가 가장 긴 것 — 마지막 폴백
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

  return {
    title: null,
    text: text.length > 150 ? text : null,
    excerpt,
    image,
  };
}

// 봇 차단 완화 — SNS 링크 크롤러(facebook/kakao)인 척 요청한다.
// Cloudflare 등은 SNS 미리보기 크롤러 UA 를 화이트리스트로 통과시키는 경우가 많아,
// 일반 Chrome UA 로는 403 이던 사이트(우아한형제들 등)도 본문을 내준다. (실측 검증)
export async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php); " +
        "kakaotalk-scrap/1.0",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  return await res.text();
}
