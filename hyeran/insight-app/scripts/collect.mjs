// 수집 파이프라인: 6개 기업 RSS → 원문 추출 → Gemini 요약 → posts 저장 (URL 중복 제거)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Parser from "rss-parser";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const get = (k) => { const m = env.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].trim() : null; };

const PER_COMPANY = Number(process.env.PER_COMPANY || 60); // 기업당 최대 글 수(캡)
const FROM = new Date(process.env.FROM || "2026-02-01"); // 이 날짜 이후 글만 수집
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));
const genAI = new GoogleGenerativeAI(get("GEMINI_API_KEY"));
const model = genAI.getGenerativeModel({
  model: get("GEMINI_MODEL") || "gemini-flash-lite-latest",
  generationConfig: { responseMimeType: "application/json" },
});
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
  return src && !src.startsWith("data:") ? src : "";
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

async function summarize(title, text) {
  const prompt = `다음 기술 블로그 글을 분석해서 JSON으로만 답해.
규칙:
- problem/solution/learning: 각각 한 문장, 한국어, 마침표 없이 (problem=무슨 문제를 다뤘나, solution=어떻게 해결했나, learning=기획 관점에서 무엇을 배울 수 있나)
- category: 다음 11개 중 정확히 하나 — "프로덕트" | "UIUX" | "디자인" | "AI" | "비즈니스" | "데이터 분석" | "프론트엔드" | "백엔드" | "데이터베이스" | "보안" | "모바일"
  (UIUX=화면·플로우·사용성·인터랙션 / 디자인=비주얼·브랜드·디자인시스템 / 프로덕트=기획·그로스·의사결정 / 비즈니스=사업·전략·조직)
- tags: 핵심 키워드 2~4개 (한국어 문자열 배열)
출력: {"problem":"...","solution":"...","learning":"...","category":"...","tags":["...","..."]}

제목: ${title}
본문:
${text.slice(0, 8000)}`;
  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}

const CATS = ["프로덕트", "UIUX", "디자인", "AI", "비즈니스", "데이터 분석", "프론트엔드", "백엔드", "데이터베이스", "보안", "모바일"];

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
        // 원문 추출 (차단 페이지면 RSS 본문으로 폴백)
        let text = "", parsed = false, body = [];
        try {
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

        // AI 요약
        const s = await summarize(it.title, text);
        const category = CATS.includes(s.category) ? s.category : "프론트엔드";
        const tags = Array.isArray(s.tags) ? s.tags.slice(0, 4).map(String) : [];
        const publishedAt = it.isoDate || it.pubDate || new Date().toISOString();

        const { error } = await sb.from("posts").insert({
          company_id: c.id, title: it.title, url, category, tags,
          source: "crawl", author_id: null,
          ai_summary: { problem: s.problem || "", solution: s.solution || "", learning: s.learning || "" },
          body, parsed, published_at: new Date(publishedAt).toISOString(),
        });
        if (error) { console.log(`  ✗ 저장 실패: ${it.title} — ${error.message}`); failed++; }
        else { console.log(`  ✓ ${c.name} · [${category}] ${it.title}${parsed ? "" : " (원문 없음)"}`); inserted++; seen.add(url); }

        await sleep(4500); // Gemini 무료 한도(분당 15회) 대비 간격
      } catch (e) { console.log(`  ✗ 처리 실패: ${it.title} — ${e.message}`); failed++; }
    }
  }
  console.log(`\n완료 — 신규 ${inserted} · 건너뜀 ${skipped} · 실패 ${failed}`);
})().catch((e) => console.log("오류:", e.message));
