// 글 페이지가 봇 차단(403)인 Medium 계열: RSS content:encoded 에서 이미지 포함 본문 재구성.
// 이미지 없는 크롤 글만, 하이라이트 없는 글만 대상 (sentence_idx 보호).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";
import { JSDOM } from "jsdom";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const get = (k) => { const m = env.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].trim() : null; };
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0 Safari/537.36";
const parser = new Parser();

function toSentences(text) {
  return text.replace(/\r/g, "").split(/\n+|(?<=[.!?。？！])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 12).slice(0, 40);
}
function imgSrc(n) {
  let src = n.getAttribute("src") || n.getAttribute("data-src") || n.getAttribute("data-lazy-src") || n.getAttribute("data-original") || "";
  if (!src || src.startsWith("data:")) { const ss = n.getAttribute("srcset") || n.getAttribute("data-srcset") || ""; if (ss) src = ss.split(",")[0].trim().split(/\s+/)[0] || ""; }
  return src && !src.startsWith("data:") ? src : "";
}
function bodyFromHtmlContent(contentHtml, baseUrl) {
  if (!contentHtml) return [];
  const doc = new JSDOM(`<body>${contentHtml}</body>`, { url: baseUrl }).window.document;
  const out = [];
  doc.querySelectorAll("p, h1, h2, h3, h4, li, figcaption, img, source").forEach((n) => {
    if (out.length >= 90) return;
    const tag = n.tagName.toLowerCase();
    if (tag === "img" || tag === "source") { const src = imgSrc(n); if (src) { try { const u = "::img::" + new URL(src, baseUrl).href; if (out[out.length - 1] !== u) out.push(u); } catch {} } }
    else { const txt = (n.textContent || "").replace(/\s+/g, " ").trim(); if (txt) toSentences(txt).forEach((s) => out.push(s)); }
  });
  return out;
}

const { data: companies } = await sb.from("companies").select("id,name,rss_url");
let updated = 0, skipped = 0;
for (const c of companies) {
  let items = [];
  try { const r = await fetch(c.rss_url, { headers: { "User-Agent": UA } }); items = (await parser.parseString(await r.text())).items || []; }
  catch { continue; }
  const byUrl = new Map(items.map((it) => [it.link, it]));
  const { data: posts } = await sb.from("posts").select("id,url,body").eq("company_id", c.id).eq("source", "crawl");
  for (const p of posts || []) {
    if ((p.body || []).some((s) => s.startsWith("::img::"))) { skipped++; continue; }
    const it = byUrl.get(p.url);
    const rawHtml = it && (it["content:encoded"] || it.content || "");
    if (!rawHtml) { skipped++; continue; }
    const { count } = await sb.from("highlights").select("*", { count: "exact", head: true }).eq("post_id", p.id);
    if (count) { skipped++; continue; }
    const body = bodyFromHtmlContent(rawHtml, p.url);
    const imgs = body.filter((s) => s.startsWith("::img::")).length;
    if (imgs > 0) { await sb.from("posts").update({ body }).eq("id", p.id); console.log(`  ✓ ${c.name} 이미지 ${imgs}장 — ${(it.title || "").slice(0, 36)}`); updated++; }
    else skipped++;
  }
}
console.log(`\n완료 — 업데이트 ${updated} · 건너뜀 ${skipped}`);
