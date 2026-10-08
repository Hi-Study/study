/**
 * 0단계 — 수집. RSS·Atom 피드 / 목록 페이지에서 글을 모으고, 티저뿐이면 원문 페이지에서 본문을 다시 가져온다.
 * 기준 문서: docs/01_분류기준.md 0단계
 */
import * as cheerio from "cheerio";
import { XMLParser } from "fast-xml-parser";
import { COMPANIES } from "./companies";
import { cleanHtml, extractMainHtml, htmlToText } from "./content";
import { insertArticle } from "../shared/db";
import type { Company } from "../shared/types";

const UA = "Mozilla/5.0 (techblog-perspective local demo)";
const MIN_CONTENT = 500;

type FeedItem = { title: string; url: string; publishedAt: string; html: string };

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@", textNodeName: "#text", cdataPropName: "#cdata" });

function txt(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string" || typeof v === "number") return String(v);
  if (Array.isArray(v)) return txt(v[0]);
  const o = v as Record<string, unknown>;
  return txt(o["#cdata"] ?? o["#text"] ?? "");
}

function arr<T>(v: T | T[] | undefined): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

export async function fetchText(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return res.text();
}

export async function readFeed(c: Company): Promise<FeedItem[]> {
  if (!c.feedUrl) return [];
  const doc = parser.parse(await fetchText(c.feedUrl));
  if (doc.rss) {
    return arr(doc.rss.channel?.item).map((it: Record<string, unknown>) => ({
      title: txt(it.title).trim(),
      url: txt(it.link).trim(),
      publishedAt: new Date(txt(it.pubDate) || Date.now()).toISOString(),
      html: txt(it["content:encoded"]) || txt(it.description),
    }));
  }
  if (doc.feed) {
    return arr(doc.feed.entry).map((it: Record<string, unknown>) => {
      const links = arr(it.link as Record<string, string> | Record<string, string>[]);
      const href = (links.find((l) => !l["@rel"] || l["@rel"] === "alternate") ?? links[0])?.["@href"] ?? "";
      return {
        title: txt(it.title).trim(),
        url: href,
        publishedAt: new Date(txt(it.published) || txt(it.updated) || Date.now()).toISOString(),
        html: txt(it.content) || txt(it.summary),
      };
    });
  }
  return [];
}

/** 글 페이지 하나에서 제목·날짜·본문을 뽑는다 (RSS 없는 블로그, add-url) */
export async function readArticlePage(url: string): Promise<FeedItem> {
  const page = await fetchText(url);
  const $ = cheerio.load(page);
  const title = ($('meta[property="og:title"]').attr("content") ?? $("h1").first().text() ?? $("title").text()).trim();
  const dated =
    $('meta[property="article:published_time"]').attr("content") ??
    $("time[datetime]").attr("datetime") ??
    decodeURI(url).match(/(20\d{2}-\d{2}-\d{2})/)?.[1];
  const d = dated ? new Date(dated) : new Date();
  return {
    title,
    url,
    publishedAt: (isNaN(d.getTime()) ? new Date() : d).toISOString(),
    html: extractMainHtml(page),
  };
}

/** 목록 페이지의 구조화 데이터(JSON-LD)에서 글 주소와 발행일을 뽑는다 — 링크 순서가 최신순이 아닌 블로그용 */
function datedLinksFromJsonLd($: cheerio.CheerioAPI, base: string, re: RegExp): { url: string; date: string }[] {
  const out = new Map<string, string>();
  const walk = (o: unknown) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (!o || typeof o !== "object") return;
    const r = o as Record<string, unknown>;
    const href = typeof r.url === "string" ? r.url : typeof r["@id"] === "string" ? (r["@id"] as string) : "";
    if (typeof r.datePublished === "string" && href) {
      const u = new URL(href, base);
      if (re.test(u.pathname)) out.set(u.toString(), r.datePublished);
    }
    Object.values(r).forEach(walk);
  };
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      walk(JSON.parse($(el).text()));
    } catch {
      /* 깨진 블록은 건너뛴다 */
    }
  });
  return [...out].map(([url, date]) => ({ url, date })).sort((a, b) => b.date.localeCompare(a.date));
}

/** RSS 가 없는 블로그: 목록 페이지에서 글 링크를 모은다 (발행일을 알 수 있으면 최신순) */
export async function readListPage(c: Company, limit: number): Promise<FeedItem[]> {
  if (!c.listPage) return [];
  const base = c.listPage.url;
  const $ = cheerio.load(await fetchText(base));
  const re = new RegExp(c.listPage.linkPattern);
  const dated = datedLinksFromJsonLd($, base, re);
  const urls = dated.length
    ? dated.map((d) => d.url)
    : [
        ...new Set(
          $("a[href]")
            .map((_, el) => $(el).attr("href") ?? "")
            .get()
            .filter((h) => re.test(h) || re.test(new URL(h, base).pathname))
            .map((h) => new URL(h, base).toString()),
        ),
      ];
  const dateOf = new Map(dated.map((d) => [d.url, d.date]));
  const out: FeedItem[] = [];
  for (const u of urls.slice(0, limit)) {
    try {
      const item = await readArticlePage(u);
      const d = dateOf.get(u);
      if (d) item.publishedAt = new Date(d).toISOString();
      out.push(item);
    } catch {
      /* 개별 글 실패는 건너뛴다 */
    }
  }
  return out;
}

/** RSS 본문이 티저뿐이면 원문 페이지에서 다시 가져온다 */
export async function ensureFullContent(url: string, html: string): Promise<string> {
  if (htmlToText(html).length >= MIN_CONTENT) return cleanHtml(html, url);
  try {
    const main = extractMainHtml(await fetchText(url));
    if (htmlToText(main).length > htmlToText(html).length) return cleanHtml(main, url);
  } catch {
    /* 원문 페이지 실패 → RSS 본문 유지 */
  }
  return cleanHtml(html, url);
}

export async function collectFeeds(perCompany: number, log: (m: string) => void, only?: string[]) {
  let added = 0;
  for (const c of COMPANIES.filter((x) => !only?.length || only.includes(x.id))) {
    try {
      const items = c.feedUrl ? (await readFeed(c)).slice(0, perCompany) : await readListPage(c, perCompany);
      let n = 0;
      for (const it of items) {
        if (!it.url || !it.title) continue;
        const html = await ensureFullContent(it.url, it.html);
        const id = await insertArticle({ companyId: c.id, title: it.title, url: it.url, publishedAt: it.publishedAt, contentHtml: html });
        if (id) n++;
      }
      added += n;
      log(`✓ ${c.name}: 새 글 ${n}건`);
    } catch (e) {
      log(`✗ ${c.name}: ${(e as Error).message}`);
    }
  }
  return added;
}
