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

export function metaContent(html: string, key: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`,
    "i",
  );
  return html.match(re)?.[1] ?? null;
}

export function decodeEntities(s: string): string {
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

// 콘텐츠 이미지가 아닌 것(이모지·스페이서·트래킹 픽셀·아바타)을 URL 로 걸러낸다.
const IMG_SKIP_RE =
  /s\.w\.org\/images\/core\/emoji|\/emoji\/|twemoji|wp-smiley|spacer\.gif|1x1\.|\/blank\.|\/pixel\.|gravatar\.com\/avatar|\.svg([?#]|$)/i;

// 사이트 껍데기(헤더/푸터) 이미지 — 로고·아이콘·아바타는 본문 이미지가 아니다.
//   실측: 올리브영 본문 첫 이미지로 헤더 로고(ic_logo.png)가 딸려 들어왔다.
const IMG_CHROME_RE =
  /(^|[\/_-])(logo|logos|ic_logo|favicon|sprite|avatar|profile|badge|thumb_default)([\/_.-]|$)|\/icons?\//i;

/**
 * 상대경로 이미지 URL 을 절대경로로 바꾼다.
 *
 * ⚠️ 이걸 안 하면 이미지를 통째로 잃는다. 실측(2026-09): 올리브영 190건 · 네이버 D2 21건 ·
 *    강남언니 28건이 본문 이미지 0개였는데, 전부 `<img src="/static/...">` 처럼 상대경로라
 *    `^https?://` 검사에서 걸러지고 있었다.
 *
 * base 를 모르면(피드 파싱 등) 바꿀 수 없으므로 빈 문자열을 돌려주고 호출부가 버린다.
 */
export function absoluteUrl(url: string, base?: string): string {
  const u = url.trim();
  if (!u) return "";
  if (/^https?:\/\//i.test(u)) return u;
  if (/^\/\//.test(u)) return "https:" + u;   // 프로토콜 상대
  if (/^data:/i.test(u)) return "";           // 인라인 base64 는 렌더 대상 아님
  if (!base) return "";
  try {
    return new URL(u, base).toString();       // "/static/a.png", "../b.png" 모두 처리
  } catch {
    return "";
  }
}

function attrValue(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"));
  return m ? m[1].trim() : "";
}

function srcsetFirst(tag: string): string {
  const raw = attrValue(tag, "srcset");
  if (!raw) return "";
  // "urlA 320w, urlB 640w" → 첫 URL
  return raw.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
}

/**
 * <img> 태그 하나를 [[img:URL]] 마커로 변환. 실제 URL 을 못 찾거나 콘텐츠 이미지가 아니면 공백.
 * @param base 글 URL — 상대경로(`/static/a.png`)를 절대경로로 만드는 기준.
 *   ⚠️ base 를 안 넘기면 상대경로 이미지는 **전부 버려진다**(실측: 올리브영·D2·강남언니 240여 건).
 */
export function imgToMarker(tag: string, base?: string): string {
  if (/\bclass=["'][^"']*wp-smiley[^"']*["']/i.test(tag)) return " ";
  // data-* 지연로딩 속성을 먼저 본다. 다만 src 에 base64 플레이스홀더를 넣는 사이트가 있어서
  // (강남언니) 후보를 순서대로 훑되 **절대경로로 바뀌는 첫 값**을 쓴다.
  const candidates = [
    attrValue(tag, "data-src"),
    attrValue(tag, "data-lazy-src"),
    attrValue(tag, "data-original"),
    attrValue(tag, "data-echo"),
    srcsetFirst(tag),
    attrValue(tag, "src"),
  ];
  let url = "";
  for (const cand of candidates) {
    if (!cand) continue;
    const abs = absoluteUrl(cand, base);   // 상대경로도 여기서 절대경로가 된다
    if (abs && !IMG_SKIP_RE.test(abs)) {
      url = abs;
      break;
    }
  }
  if (!url) return " ";
  return `\n[[img:${url}]]\n`;
}

/**
 * 본문(마커가 박힌 평문)에서 첫 이미지 URL 을 꺼낸다 — **대표 이미지 폴백**.
 *
 * 실측(2026-09): 올리브영 190건이 og:image 를 못 얻어 카드 썸네일이 전부 비어 있었다.
 * 본문에 이미지가 있으면 그중 첫 장을 대표로 쓰는 게 빈 카드보다 낫다.
 */
export function firstBodyImage(body: string | null | undefined): string | null {
  if (!body) return null;
  const m = body.match(/\[\[img:(https?:\/\/[^\]]+)\]\]/);
  return m ? m[1] : null;
}

/**
 * 입력이 **엔티티로 이스케이프된 HTML**인지 판별.
 *
 * Atom 피드는 본문을 `<content type="html">&lt;p&gt;…</content>` 처럼 이스케이프해서 싣는다
 * (RSS 의 content:encoded 는 보통 CDATA 라 날 HTML 이다). 이걸 그대로 htmlToText 에 넣으면
 * 태그가 태그로 안 보여서 **이미지를 못 찾고, 마지막 디코드 단계에서 날 HTML 이 본문에 남는다.**
 * (실측: 네이버 D2 24건 — 본문이 `<html><head></head><body><p dir="auto">…` 로 저장돼 있었다.)
 */
function looksEscapedHtml(s: string): boolean {
  const esc = (s.match(/&lt;\/?[a-z]/gi) ?? []).length;
  if (esc < 3) return false;
  const real = (s.match(/<\/?[a-z][^>]*>/gi) ?? []).length;
  return esc > real; // 이스케이프된 태그가 더 많으면 이스케이프본으로 본다
}

/** @param base 글 URL — 본문 안 상대경로 이미지를 절대경로로 만드는 기준. */
export function htmlToText(html: string, base?: string): string {
  // 이스케이프된 HTML 이면 **먼저 한 번 풀어서** 진짜 태그로 만든 뒤 처리한다.
  let s = looksEscapedHtml(html) ? decodeEntities(html) : html;
  s = s
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  // 블록 태그 종료 → 줄바꿈
  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|section|article|tr|blockquote)>/gi, "\n");
  // <img> 는 버리지 말고 [[img:URL]] 마커로 보존(앱에서 이미지로 렌더).
  // 여러 lazy-load 속성/srcset 을 폭넓게 지원하고, 이모지·스페이서·트래킹 픽셀은 제외.
  s = s.replace(/<img\b[^>]*>/gi, (tag) => imgToMarker(tag, base));
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

/** @param base 글 URL — 상대경로 이미지(og:image · 본문 <img>)를 절대경로로 만드는 기준. */
export function extractArticle(html: string, base?: string): Extracted {
  // 대표 이미지 — og:image 우선, 없으면 secure_url·twitter:image 등으로 폭넓게 폴백.
  const rawImage =
    metaContent(html, "og:image") ??
    metaContent(html, "og:image:secure_url") ??
    metaContent(html, "og:image:url") ??
    metaContent(html, "twitter:image") ??
    metaContent(html, "twitter:image:src");
  // og:image 도 상대경로로 주는 사이트가 있다(절대경로면 그대로 통과).
  let image = rawImage ? absoluteUrl(rawImage, base) || null : null;
  const excerpt =
    metaContent(html, "og:description") ?? metaContent(html, "description");

  let text = "";

  // 1) 사이트 표준 본문 컨테이너
  for (const sel of SITE_SELECTORS) {
    const inner = grabByAttr(html, sel);
    if (inner) {
      const t = stripFooter(htmlToText(inner, base));
      if (t.length >= 200) {
        text = t;
        break;
      }
    }
  }

  // 2) 문단 밀도: 실제 문장이 담긴 <p> 만 모음(블로그 범용 — 목차/GNB/사이드바 자동 배제)
  //    ⚠️ <p> 만 보면 **본문 이미지를 통째로 잃는다**. 요즘 블로그는 이미지를 <figure> 나
  //       <p> 밖 독립 <img> 로 넣기 때문(실측: 강남언니 — 본문 9,000자에 마커 0개).
  //       그래서 <p> · <figure> · 독립 <img> 를 **문서 순서대로** 함께 훑고,
  //       "본문이냐" 판정(300자 이상)은 종전대로 산문 길이로만 한다(이미지가 기준을 흐리지 않게).
  if (!text) {
    const blocks: string[] = [];
    let proseLen = 0;
    const re = /<p\b[^>]*>([\s\S]*?)<\/p>|<figure\b[^>]*>([\s\S]*?)<\/figure>|<img\b[^>]*>/gi;
    const imagesOnly = (chunk: string): string =>
      (htmlToText(chunk, base).match(/\[\[img:[^\]]+\]\]/g) ?? [])
        .filter((mk) => !IMG_CHROME_RE.test(mk))
        .join("\n");

    // 위치를 함께 기록한다 — 이미지는 **첫 본문 문단과 마지막 본문 문단 사이**의 것만 쓴다.
    //   헤더 로고·푸터 배너가 본문에 섞여 들어오는 걸 파일명 추측 없이 막는 방법이다.
    const items: { at: number; text: string; prose: boolean }[] = [];
    for (const m of html.matchAll(re)) {
      const at = m.index ?? 0;
      const inner = m[1];
      if (inner !== undefined) {
        // <p> — 40자 이상 문장 + 링크(<a>) 1개 이하 → 메뉴/목차/각주 링크 뭉치 배제
        const t = htmlToText(inner, base);
        const prose = t.replace(/\[\[img:[^\]]+\]\]/g, "").trim();
        if (prose.length >= 40 && (inner.match(/<a\b/gi) ?? []).length <= 1) {
          items.push({ at, text: t, prose: true });
          proseLen += prose.length;
        } else {
          const only = imagesOnly(inner);
          if (only) items.push({ at, text: only, prose: false });
        }
      } else {
        // <figure> 또는 독립 <img> — 이미지 마커만 건진다(캡션은 버림: 중복 표시 방지).
        const only = imagesOnly(m[0]);
        if (only) items.push({ at, text: only, prose: false });
      }
    }

    // ⚠️ "첫 문단~마지막 문단 사이"로 이미지를 제한했더니 오히려 이미지를 다 죽였다.
    //    Gatsby(올리브영)는 이미지를 문단보다 **앞쪽**에 SSR 하고, 워드프레스(NDS)는
    //    본문이 <p> 하나뿐이라 범위가 한 점이 된다. 껍데기 이미지는 IMG_CHROME_RE 가
    //    이미 거르므로 위치로 자르지 않는다.
    for (const x of items) blocks.push(x.text);
    if (proseLen >= 300) text = stripFooter(blocks.join("\n"));
  }

  // 3) 시맨틱 영역(<article>/<main>) 중 텍스트가 가장 긴 것.
  //    ⚠️ 예전엔 "앞 경로가 실패했을 때만" 봤는데, 문단 밀도 경로가 **성공했지만 형편없는**
  //       경우가 많다(실측: 올리브영 4,228자 vs article 10,033자 / NDS 736자 vs 8,573자).
  //       그래서 항상 계산해 두고, 1.5배 이상 길면 이쪽을 채택한다.
  {
    const regions = [
      ...html.matchAll(/<article[\s\S]*?<\/article>/gi),
      ...html.matchAll(/<main[\s\S]*?<\/main>/gi),
    ].map((m) => m[0]);
    let best = "";
    for (const r of regions) {
      const t = htmlToText(r, base);
      if (t.length > best.length) best = t;
    }
    const semantic = best.length >= 400 ? stripFooter(best) : "";
    if (semantic && (!text || semantic.length > text.length * 1.5)) text = semantic;
  }

  return {
    title: null,
    text: text.length > 150 ? text : null,
    excerpt,
    image,
  };
}

// SNS 링크 크롤러(facebook/kakao) UA — Cloudflare 등이 미리보기 크롤러를 화이트리스트로
// 통과시켜, 일반 Chrome UA 로는 403 이던 본문 페이지(우아한형제들 등)도 내준다. (실측)
export const CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php); kakaotalk-scrap/1.0";
// 일반 브라우저 UA — 일부 사이트는 반대로 크롤러 UA 에 SPA 셸만 주고 브라우저에만
// 진짜 피드/본문을 준다(네이버 D2 의 atom 피드 등). 피드 요청 기본값. (실측)
export const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// 봇 차단 완화용 요청. 본문 페이지는 CRAWLER_UA(기본), 피드는 BROWSER_UA 를 넘겨 쓴다.
export async function fetchHtml(url: string, ua: string = CRAWLER_UA): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
    },
  });
  return await res.text();
}
