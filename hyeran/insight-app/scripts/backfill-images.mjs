// 기존 크롤 글의 본문을 이미지 포함으로 재추출 (Gemini 미사용).
// 하이라이트가 있는 글은 sentence_idx 어긋남 방지를 위해 건너뜀.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const get = (k) => { const m = env.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].trim() : null; };
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function toSentences(text) {
  return text.replace(/\r/g, "").split(/\n+|(?<=[.!?。？！])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 12).slice(0, 40);
}
function imgSrc(n) {
  let src = n.getAttribute("src") || n.getAttribute("data-src") || n.getAttribute("data-lazy-src") || n.getAttribute("data-original") || "";
  if (!src || src.startsWith("data:")) {
    const ss = n.getAttribute("srcset") || n.getAttribute("data-srcset") || "";
    if (ss) src = ss.split(",")[0].trim().split(/\s+/)[0] || "";
  }
  return src && !src.startsWith("data:") ? src : "";
}
function bodyFromArticle(art, baseUrl) {
  if (!art?.content) return [];
  const doc = new JSDOM(`<body>${art.content}</body>`, { url: baseUrl }).window.document;
  const out = [];
  doc.querySelectorAll("p, h1, h2, h3, h4, li, figcaption, img, source").forEach((n) => {
    if (out.length >= 90) return;
    const tag = n.tagName.toLowerCase();
    if (tag === "img" || tag === "source") {
      const src = imgSrc(n);
      if (src) { try { const u = "::img::" + new URL(src, baseUrl).href; if (out[out.length - 1] !== u) out.push(u); } catch {} }
    } else {
      const txt = (n.textContent || "").replace(/\s+/g, " ").trim();
      if (txt) toSentences(txt).forEach((s) => out.push(s));
    }
  });
  return out;
}

const { data: posts } = await sb.from("posts").select("id,url,body,parsed").eq("source", "crawl").eq("parsed", true);
console.log(`대상 ${posts?.length || 0}건`);
let updated = 0, skipped = 0;
for (const p of posts || []) {
  const hasImg = (p.body || []).some((s) => s.startsWith("::img::"));
  if (hasImg) { skipped++; continue; }
  const { count } = await sb.from("highlights").select("*", { count: "exact", head: true }).eq("post_id", p.id);
  if (count) { console.log(`  skip(하이라이트 있음): ${p.id}`); skipped++; continue; }
  try {
    const r = await fetch(p.url, { headers: { "User-Agent": UA }, redirect: "follow" });
    const art = new Readability(new JSDOM(await r.text(), { url: p.url }).window.document).parse();
    const body = bodyFromArticle(art, p.url);
    const imgs = body.filter((s) => s.startsWith("::img::")).length;
    if (imgs > 0) {
      await sb.from("posts").update({ body }).eq("id", p.id);
      console.log(`  ✓ 이미지 ${imgs}장 추가 — ${(art?.title || p.url).slice(0, 40)}`);
      updated++;
    } else skipped++;
  } catch (e) { console.log(`  ✗ ${e.message.slice(0, 40)}`); skipped++; }
  await sleep(400);
}
console.log(`\n완료 — 업데이트 ${updated} · 건너뜀 ${skipped}`);
