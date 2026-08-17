// 기존 parsed 글의 body 를 구조형 블록(::h2::/::p::/::li::/::quote::/::code::/::img::/::cap::)으로 재수집.
// 라이브 페이지(Readability) 우선, 봇차단 Medium계열은 RSS content:encoded 사용. Gemini 미사용.
// 블록 인덱스가 바뀌므로 재수집한 글의 highlights 는 삭제.
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
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";
const parser = new Parser({ timeout: 15000, headers: { "User-Agent": UA } });

const looksBlocked = (t) => !t || t.length < 400 || /cloudflare|just a moment|attention required|잠시만 기다|enable javascript and cookies|verify you are/i.test(t);
function imgSrc(n) {
  let src = n.getAttribute("src") || n.getAttribute("data-src") || n.getAttribute("data-lazy-src") || n.getAttribute("data-original") || "";
  if (!src || src.startsWith("data:")) { const ss = n.getAttribute("srcset") || n.getAttribute("data-srcset") || ""; if (ss) src = ss.split(",")[0].trim().split(/\s+/)[0] || ""; }
  return src && !src.startsWith("data:") ? src : "";
}
function blockType(tag) {
  if (tag === "h1" || tag === "h2") return "h2";
  if (tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") return "h3";
  if (tag === "li") return "li";
  if (tag === "blockquote") return "quote";
  if (tag === "pre") return "code";
  if (tag === "figcaption") return "cap";
  return "p";
}
function bodyFromHtmlContent(contentHtml, baseUrl) {
  if (!contentHtml) return [];
  const doc = new JSDOM(`<body>${contentHtml}</body>`, { url: baseUrl }).window.document;
  const out = [];
  const push = (v) => { if (out.length < 140 && out[out.length - 1] !== v) out.push(v); };
  doc.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption,img,source").forEach((n) => {
    const tag = n.tagName.toLowerCase();
    if (tag === "img" || tag === "source") { const src = imgSrc(n); if (src) { try { push("::img::" + new URL(src, baseUrl).href); } catch {} } return; }
    if (tag === "p" && n.closest("blockquote, pre, li")) return;
    const txt = (n.textContent || "").replace(/\s+/g, " ").trim();
    if (txt.length < 2) return;
    push(`::${blockType(tag)}::${txt}`);
  });
  return out;
}

// 1) 회사 RSS content 맵 (url → content:encoded)
const { data: companies } = await sb.from("companies").select("rss_url");
const rssMap = new Map();
for (const c of companies || []) {
  try {
    const r = await fetch(c.rss_url, { headers: { "User-Agent": UA } });
    const feed = await parser.parseString(await r.text());
    (feed.items || []).forEach((it) => { if (it.link) rssMap.set(it.link, it["content:encoded"] || it.content || ""); });
  } catch {}
}
console.log("RSS 항목:", rssMap.size);

// 2) parsed 글 재수집
const { data: posts } = await sb.from("posts").select("id,url,title").eq("parsed", true);
console.log("대상 parsed 글:", posts?.length || 0);
let updated = 0, skipped = 0;
for (const p of posts || []) {
  let body = [];
  try {
    const r = await fetch(p.url, { headers: { "User-Agent": UA }, redirect: "follow" });
    const art = new Readability(new JSDOM(await r.text(), { url: p.url }).window.document).parse();
    if (!looksBlocked((art?.textContent || "").trim())) body = bodyFromHtmlContent(art?.content, p.url);
  } catch {}
  if (!body.length && rssMap.has(p.url)) body = bodyFromHtmlContent(rssMap.get(p.url), p.url);
  if (!body.length) { skipped++; continue; }
  await sb.from("posts").update({ body }).eq("id", p.id);
  await sb.from("highlights").delete().eq("post_id", p.id); // 인덱스 변경 → 기존 하이라이트 정리
  const heads = body.filter((s) => s.startsWith("::h")).length;
  const imgs = body.filter((s) => s.startsWith("::img::")).length;
  console.log(`  ✓ ${p.title.slice(0, 34)} — 블록 ${body.length} (헤딩 ${heads}·이미지 ${imgs})`);
  updated++;
  await new Promise((r) => setTimeout(r, 300));
}
console.log(`\n완료 — 업데이트 ${updated} · 건너뜀 ${skipped}`);
