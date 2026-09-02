// RSS 2.0 / Atom 피드 파서 (정규식 기반, DOM 라이브러리 미사용 — Deno Deploy 번들 안전).
// content:encoded(본문 O) · media:content(대표 이미지) · dc:creator(작성자) 등 실측 태그를 처리한다.
import { decodeEntities, htmlToText, stripFooter } from "./extract.ts";

export interface FeedItem {
  url: string;
  title: string;
  author: string | null;
  published: string | null; // ISO8601 (파싱 실패 시 null)
  summary: string | null;
  contentHtml: string | null; // 본문 HTML(rss_full: content:encoded / atom content)
  image: string | null; // media:* 또는 본문 첫 이미지
}

// <name ...>inner</name> 의 inner 반환. CDATA 는 벗겨서 준다. (네임스페이스 : 는 정확 매칭)
function tag(block: string, name: string): string | null {
  const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`, "i");
  const m = block.match(re);
  return m ? unwrap(m[1]) : null;
}
function unwrap(s: string): string {
  const cd = s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return cd ? cd[1] : s;
}

// 원문 링크: RSS <link>URL</link> → Atom rel="alternate" → Atom 첫 href
function pickLink(block: string): string | null {
  const rss = tag(block, "link");
  if (rss && /^https?:/i.test(rss.trim())) return rss.trim();
  const alt =
    block.match(/<link[^>]+rel=["']alternate["'][^>]*href=["']([^"']+)["']/i) ??
    block.match(/<link[^>]+href=["']([^"']+)["'][^>]*rel=["']alternate["']/i);
  if (alt) return alt[1];
  const href = block.match(/<link[^>]+href=["']([^"']+)["']/i);
  return href ? href[1] : null;
}

function pickAuthor(block: string): string | null {
  const dc = tag(block, "dc:creator");
  if (dc) return dc.replace(/<[^>]+>/g, "").trim() || null;
  const atom = block.match(/<author>[\s\S]*?<name>([\s\S]*?)<\/name>/i);
  if (atom) return unwrap(atom[1]).trim() || null;
  const a = tag(block, "author");
  return a ? a.replace(/<[^>]+>/g, "").trim() || null : null;
}

function toISO(s: string | null): string | null {
  if (!s) return null;
  const d = new Date(s.trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// 트래킹 파라미터(source=rss…, utm_*, gi)·해시 제거 → 정본 URL(중복키 안정화).
export function cleanUrl(u: string): string {
  try {
    const url = new URL(u);
    for (const k of [...url.searchParams.keys()]) {
      if (k === "source" || k === "gi" || k.startsWith("utm_")) url.searchParams.delete(k);
    }
    url.hash = "";
    return url.toString().replace(/\?$/, "");
  } catch {
    return u;
  }
}

// 본문 HTML 첫 "진짜" 이미지(트래킹 픽셀·1x1 제외)
export function firstImage(html: string | null): string | null {
  if (!html) return null;
  for (const m of html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)) {
    const src = m[1];
    if (!/^https?:\/\//i.test(src)) continue;
    if (/\/stat[?/]|1x1|pixel|spacer|blank\.gif|tracking|\/_\/stat/i.test(src)) continue;
    return src;
  }
  return null;
}

/** RSS/Atom XML → 피드 아이템 목록(최신순, 피드 원 순서 유지). */
export function parseFeed(xml: string): FeedItem[] {
  const blocks =
    xml.match(/<item\b[\s\S]*?<\/item>/gi) ??
    xml.match(/<entry\b[\s\S]*?<\/entry>/gi) ??
    [];
  const items: FeedItem[] = [];
  for (const b of blocks) {
    const url = pickLink(b);
    const rawTitle = tag(b, "title");
    if (!url || !rawTitle) continue;
    const title = decodeEntities(rawTitle.replace(/<[^>]+>/g, "")).trim();
    if (!title) continue;

    const contentHtml = tag(b, "content:encoded") ?? tag(b, "content");
    const descr = tag(b, "description") ?? tag(b, "summary");
    const summary = descr ? htmlToText(descr).replace(/\n+/g, " ").slice(0, 300) : null;
    const media =
      b.match(/<media:(?:content|thumbnail)[^>]+url=["']([^"']+)["']/i)?.[1] ??
      b.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image/i)?.[1] ??
      null;

    items.push({
      url: cleanUrl(url.trim()),
      title,
      author: pickAuthor(b),
      published: toISO(
        tag(b, "pubDate") ?? tag(b, "published") ?? tag(b, "updated") ?? tag(b, "dc:date"),
      ),
      summary,
      contentHtml,
      image: media ?? firstImage(contentHtml),
    });
  }
  return items;
}

/**
 * SPA 페이지의 상태 JSON 에서 본문 후보를 뽑는다(가장 긴 문자열 = 본문 HTML). (실측 휴리스틱)
 * 지원: Nuxt3(<script id="__NUXT_DATA__" type="application/json">[…]) — 카카오/카카오페이,
 *       Next(<script id="__NEXT_DATA__">{…}), Nuxt2(window.__NUXT__={…}).
 * 파싱 불가(함수식 등)면 null → 호출부가 extractArticle 로 폴백.
 */
/** @param base 글 URL — 상태 JSON 안 본문의 상대경로 이미지를 절대경로로 만드는 기준. */
export function extractStateBody(html: string, base?: string): string | null {
  let jsonStr: string | null = null;
  // Nuxt3: JSON 배열 페이로드(문자열 풀). id 또는 data-nuxt-data 로 식별.
  const nuxt3 = html.match(
    /<script[^>]*(?:id=["']__NUXT_DATA__["']|data-nuxt-data=["']nuxt-app["'])[^>]*>([\s\S]*?)<\/script>/i,
  );
  if (nuxt3) jsonStr = nuxt3[1];
  if (!jsonStr) {
    const next = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (next) jsonStr = next[1];
  }
  if (!jsonStr) {
    const nuxt2 = html.match(/window\.__NUXT__\s*=\s*(\{[\s\S]*\})\s*;?\s*<\/script>/);
    if (nuxt2) jsonStr = nuxt2[1];
  }
  if (!jsonStr) return null;
  try {
    const j = JSON.parse(jsonStr); // 배열/객체 모두 walk 가 순회.
    let best = "";
    const walk = (o: unknown) => {
      if (typeof o === "string") {
        if (o.length > best.length) best = o;
      } else if (o && typeof o === "object") {
        for (const k in o as Record<string, unknown>) walk((o as Record<string, unknown>)[k]);
      }
    };
    walk(j);
    if (best.length < 200) return null;
    const t = stripFooter(htmlToText(best, base));
    return t.length > 150 ? t : null;
  } catch {
    return null;
  }
}
