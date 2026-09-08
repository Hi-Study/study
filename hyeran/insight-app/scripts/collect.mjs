// 수집 파이프라인: RSS → 원문 추출 → posts 저장 (URL 중복 제거)
// 분류·요약은 하지 않는다 — scripts/judge-classify.mjs 가 맡는다.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const get = (k) => { const m = env.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].trim() : null; };

const PER_COMPANY = Number(process.env.PER_COMPANY || 60); // 기업당 최대 글 수(캡)
const FROM = new Date(process.env.FROM || "2026-02-01"); // 이 날짜 이후 글만 수집
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));

// 소스별 예외.
//   rssBody  — 원문 페이지가 JS로 그려져 Readability 가 푸터만 긁는다. RSS 본문을 쓴다.
//   scrapeDate — 피드에 pubDate 가 없다. 글 페이지의 메타 태그에서 발행일을 뽑는다.
//               (없으면 전부 오늘 날짜로 저장돼 "새로 들어온 글"이 뒤죽박죽이 된다)
const SOURCE_QUIRKS = {
  yozm: { rssBody: true, scrapeDate: true },
};

// 글 페이지 HTML 에서 발행일 추출
async function scrapePublishedAt(url) {
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
    const html = await r.text();
    for (const re of [
      /"datePublished"s*:s*"([^"]+)"/i,
      /<meta[^>]+property="article:published_time"[^>]+content="([^"]+)"/i,
      /<meta[^>]+name="date"[^>]+content="([^"]+)"/i,
    ]) {
      const m = html.match(re);
      if (m) { const d = new Date(m[1]); if (!isNaN(+d)) return d.toISOString(); }
    }
  } catch {}
  return null;
}
const parser = new Parser();

// 원문 텍스트 → 문장 배열 (리더 뷰용)
function toSentences(text) {
  return text.replace(/\r/g, "").split(/\n+|(?<=[.!?。？！])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 12).slice(0, 40);
}
// img/source 요소에서 실제 이미지 URL (lazy-load·srcset 대응)
function imgSrc(n) {
  let src = n.getAttribute("src") || n.getAttribute("data-src") || n.getAttribute("data-lazy-src") || n.getAttribute("data-original") || "";
  if (!src || src.startsWith("data:")) {
    const ss = n.getAttribute("srcset") || n.getAttribute("data-srcset") || "";
    if (ss) src = ss.split(",")[0].trim().split(/\s+/)[0] || "";
  }
  if (!src || src.startsWith("data:")) return "";
  if (/medium\.com\/_\/stat|clientViewed|\/stat\?|\/pixel|\/track|1x1/i.test(src)) return ""; // 추적 픽셀 제외
  return src;
}
// 블록 타입: 헤딩/문단/목록/인용/코드/캡션
function blockType(tag) {
  if (tag === "h1" || tag === "h2") return "h2";
  if (tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") return "h3";
  if (tag === "li") return "li";
  if (tag === "blockquote") return "quote";
  if (tag === "pre") return "code";
  if (tag === "figcaption") return "cap";
  return "p";
}
// 본문 HTML → 구조형 블록 배열 (::타입::내용). 문단·헤딩 구조 보존 (리더 뷰용)
function bodyFromHtmlContent(contentHtml, baseUrl) {
  if (!contentHtml) return [];
  const doc = new JSDOM(`<body>${contentHtml}</body>`, { url: baseUrl }).window.document;
  const out = [];
  const push = (v) => { if (out.length < 140 && out[out.length - 1] !== v) out.push(v); };
  doc.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption,img,source").forEach((n) => {
    const tag = n.tagName.toLowerCase();
    if (tag === "img" || tag === "source") {
      const src = imgSrc(n);
      if (src) { try { push("::img::" + new URL(src, baseUrl).href); } catch {} }
      return;
    }
    // 중복 방지: blockquote/pre 안의 p, li 안의 p 는 상위에서 이미 담김
    if (tag === "p" && n.closest("blockquote, pre, li")) return;
    const txt = (n.textContent || "").replace(/\s+/g, " ").trim();
    if (txt.length < 2) return;
    push(`::${blockType(tag)}::${txt}`);
  });
  return out;
}
function bodyFromArticle(art, baseUrl) {
  const o = bodyFromHtmlContent(art?.content, baseUrl);
  return o.length ? o : toSentences(art?.textContent || "");
}
const stripHtml = (h) => (h || "").replace(/<[^>]+>/g, " ").replace(/&[a-z#0-9]+;/gi, " ").replace(/\s+/g, " ").trim();
// 봇 차단/challenge 페이지인지 (원문 아님)
function looksBlocked(t) {
  return !t || t.length < 400 ||
    /cloudflare|ray id|just a moment|attention required|본문[^가-힣]*접근[^가-힣]*차단|잠시만 기다|enable javascript and cookies|verify you are/i.test(t);
}

(async () => {
  // 기존 URL (중복 제거용)
  const { data: existing } = await sb.from("posts").select("url");
  const seen = new Set((existing || []).map((p) => p.url).filter(Boolean));
  console.log(`기존 글 ${seen.size}건\n`);

  const { data: companies } = await sb.from("companies").select("id,slug,name,rss_url").order("slug");
  let inserted = 0, skipped = 0, failed = 0;

  for (const c of companies) {
    let items = [];
    try {
      const res = await fetch(c.rss_url, { headers: { "User-Agent": UA }, redirect: "follow" });
      const feed = await parser.parseString(await res.text());
      // FROM 이후 글만 (날짜 없으면 포함), 최대 PER_COMPANY
      items = (feed.items || [])
        .filter((it) => { const d = new Date(it.isoDate || it.pubDate); return isNaN(+d) ? true : d >= FROM; })
        .slice(0, PER_COMPANY);
    } catch (e) { console.log(`✗ ${c.name} 피드 실패: ${e.message}`); continue; }

    for (const it of items) {
      const url = it.link;
      if (!url || seen.has(url)) { skipped++; continue; }
      try {
        const quirks = SOURCE_QUIRKS[c.slug] ?? {};
        // 원문 추출 (차단 페이지면 RSS 본문으로 폴백)
        let text = "", parsed = false, body = [];
        try {
          if (quirks.rssBody) throw new Error("skip-readability");
          const r = await fetch(url, { headers: { "User-Agent": UA }, redirect: "follow" });
          const dom = new JSDOM(await r.text(), { url });
          const art = new Readability(dom.window.document).parse();
          const rtext = (art?.textContent || "").trim();
          if (!looksBlocked(rtext)) { text = rtext; parsed = true; body = bodyFromArticle(art, url); }
        } catch {}
        if (!parsed) {
          const rawHtml = it["content:encoded"] || it.content || "";
          const alt = stripHtml(rawHtml || it.contentSnippet || "");
          if (alt.length >= 300) {
            text = alt; parsed = true;
            body = bodyFromHtmlContent(rawHtml, url);
            if (!body.length) body = toSentences(alt);
          } else { text = (it.contentSnippet || it.title || "").trim(); parsed = false; body = []; }
        }

        let publishedAt = it.isoDate || it.pubDate || null;
        if (!publishedAt && quirks.scrapeDate) publishedAt = await scrapePublishedAt(url);
        if (!publishedAt) publishedAt = new Date().toISOString();

        // 분류·요약은 하지 않는다. 저장만 하고 판정은 judge-classify.mjs 가 한다.
        const cover = body.find((b) => b.startsWith("::img::"))?.slice("::img::".length) ?? null;
        const { error } = await sb.from("posts").insert({
          company_id: c.id, title: it.title, url,
          source: "crawl", author_id: null,
          body, cover_image: cover, parsed,
          published_at: new Date(publishedAt).toISOString(),
        });
        if (error) { console.log(`  ✗ 저장 실패: ${it.title} — ${error.message}`); failed++; }
        else { console.log(`  ✓ ${c.name} · ${it.title}${parsed ? "" : " (원문 없음)"}`); inserted++; seen.add(url); }
      } catch (e) { console.log(`  ✗ 처리 실패: ${it.title} — ${e.message}`); failed++; }
    }
  }
  console.log(`\n완료 — 신규 ${inserted} · 건너뜀 ${skipped} · 실패 ${failed}`);
})().catch((e) => console.log("오류:", e.message));
