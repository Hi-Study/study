"use server";

import { revalidatePath, revalidateTag } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { CATEGORIES, type Category } from "@/lib/types";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";

function toSentences(text: string): string[] {
  return text.replace(/\r/g, "").split(/\n+|(?<=[.!?。？！])\s+/)
    .map((s) => s.replace(/\s+/g, " ").trim()).filter((s) => s.length > 12).slice(0, 40);
}
function blockType(tag: string): string {
  if (tag === "h1" || tag === "h2") return "h2";
  if (tag === "h3" || tag === "h4" || tag === "h5" || tag === "h6") return "h3";
  if (tag === "li") return "li";
  if (tag === "blockquote") return "quote";
  if (tag === "pre") return "code";
  if (tag === "figcaption") return "cap";
  return "p";
}
// Readability 본문(HTML) → 구조형 블록 배열(::타입::내용). 문단·헤딩 구조 보존 (리더 뷰용)
function bodyFromArticle(content: string | null | undefined, textContent: string, baseUrl: string, JSDOMCtor: typeof import("jsdom").JSDOM): string[] {
  if (!content) return toSentences(textContent);
  const doc = new JSDOMCtor(`<body>${content}</body>`, { url: baseUrl }).window.document;
  const out: string[] = [];
  const push = (v: string) => { if (out.length < 140 && out[out.length - 1] !== v) out.push(v); };
  const imgSrc = (n: Element) => {
    let src = n.getAttribute("src") || n.getAttribute("data-src") || n.getAttribute("data-lazy-src") || n.getAttribute("data-original") || "";
    if (!src || src.startsWith("data:")) {
      const ss = n.getAttribute("srcset") || n.getAttribute("data-srcset") || "";
      if (ss) src = ss.split(",")[0].trim().split(/\s+/)[0] || "";
    }
    if (!src || src.startsWith("data:")) return "";
    if (/medium\.com\/_\/stat|clientViewed|\/stat\?|\/pixel|\/track|1x1/i.test(src)) return "";
    return src;
  };
  doc.querySelectorAll("h1,h2,h3,h4,h5,h6,p,li,blockquote,pre,figcaption,img,source").forEach((n) => {
    const tag = n.tagName.toLowerCase();
    if (tag === "img" || tag === "source") {
      const src = imgSrc(n);
      if (src) { try { push("::img::" + new URL(src, baseUrl).href); } catch {} }
      return;
    }
    if (tag === "p" && n.closest("blockquote, pre, li")) return;
    const txt = (n.textContent || "").replace(/\s+/g, " ").trim();
    if (txt.length < 2) return;
    push(`::${blockType(tag)}::${txt}`);
  });
  return out.length ? out : toSentences(textContent);
}
function looksBlocked(t: string) {
  return !t || t.length < 400 || /cloudflare|just a moment|attention required|잠시만 기다|enable javascript and cookies|verify you are/i.test(t);
}

type Extracted = { title: string; text: string; body: string[]; parsed: boolean };

async function extract(url: string): Promise<Extracted> {
  try {
    const { JSDOM } = await import("jsdom");
    const { Readability } = await import("@mozilla/readability");
    const res = await fetch(url, {
      headers: { "User-Agent": UA, "Accept-Language": "ko,en;q=0.8" },
      redirect: "follow",
    });
    const html = await res.text();
    const dom = new JSDOM(html, { url });
    const doc = dom.window.document;

    // 메타 폴백 (og / twitter / description)
    const meta = (sel: string) => doc.querySelector(sel)?.getAttribute("content")?.trim() || "";
    const ogTitle = meta('meta[property="og:title"]') || meta('meta[name="twitter:title"]');
    const ogDesc = meta('meta[property="og:description"]') || meta('meta[name="description"]') || meta('meta[name="twitter:description"]');

    // JSON-LD (articleBody / headline / description)
    let ldTitle = "", ldBody = "";
    doc.querySelectorAll('script[type="application/ld+json"]').forEach((s) => {
      try {
        const j = JSON.parse(s.textContent || "{}");
        const arr = Array.isArray(j) ? j : [j, ...(Array.isArray(j["@graph"]) ? j["@graph"] : [])];
        for (const o of arr) {
          if (typeof o?.articleBody === "string" && o.articleBody.length > ldBody.length) ldBody = o.articleBody;
          if (typeof o?.description === "string" && o.description.length > ldBody.length) ldBody = o.description;
          if (typeof o?.headline === "string" && !ldTitle) ldTitle = o.headline;
        }
      } catch {}
    });

    const art = new Readability(doc).parse();
    const readText = (art?.textContent || "").trim();
    const title = (art?.title || ogTitle || ldTitle || doc.title || "").trim();

    // 본문(readability)이 충분하면 원문 리더로 사용 (이미지 포함)
    if (!looksBlocked(readText)) return { title, text: readText, body: bodyFromArticle(art?.content, readText, url, JSDOM), parsed: true };

    // JS 렌더 사이트 등: 메타/LD로 요약용 텍스트 보강 (원문 리더는 미제공)
    const fb = [ldBody, ogDesc].filter(Boolean).join("\n\n").trim();
    return { title, text: fb || readText, body: [], parsed: false };
  } catch {
    return { title: "", text: "", body: [], parsed: false };
  }
}

async function summarize(title: string, text: string) {
  const { GoogleGenerativeAI } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  const model = genAI.getGenerativeModel({
    model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
    generationConfig: { responseMimeType: "application/json" },
  });
  const prompt = `다음 기술 블로그 글을 분석해서 JSON으로만 답해.
규칙:
- problem/solution/learning: 각각 한 문장, 한국어, 마침표 없이
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

export async function checkDuplicate(url: string): Promise<{ exists: boolean; postId?: string }> {
  const u = url.trim();
  if (!u) return { exists: false };
  const sb = await createClient();
  const { data } = await sb.from("posts").select("id").eq("url", u).maybeSingle();
  return data ? { exists: true, postId: data.id } : { exists: false };
}

export async function registerPost(url: string, q1: string, q2: string, q3: string) {
  const u = url.trim();
  if (!u) return { error: "URL을 입력해주세요" };
  if (![q1, q2, q3].some((x) => x.trim())) return { error: "인사이트를 최소 1개 작성해주세요" };

  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { error: "로그인이 필요해요" };

  const dup = await sb.from("posts").select("id").eq("url", u).maybeSingle();
  if (dup.data) return { duplicate: true, postId: dup.data.id };

  // 원문 추출 + AI 요약
  const ex = await extract(u);
  const content = ex.text.trim();
  // 제목·본문 어느 것도 못 가져오면 요약 불가 (링크만 저장하는 건 의미가 없음)
  if (ex.title.trim().length < 4 && content.length < 40) {
    return { error: "원문을 불러올 수 없어 요약을 만들지 못했어요. 링크를 확인하거나 다른 글로 시도해주세요" };
  }
  let s: { problem: string; solution: string; learning: string; category: string; tags: string[] };
  try {
    s = await summarize(ex.title || u, content || ex.title);
  } catch {
    return { error: "AI 요약 생성에 실패했어요. 잠시 후 다시 시도해주세요" };
  }
  const category: Category = CATEGORIES.includes(s.category as Category) ? (s.category as Category) : "프론트엔드";
  const tags = Array.isArray(s.tags) ? s.tags.slice(0, 4).map(String) : [];

  // 기업 매칭 (도메인)
  let companyId: string | null = null;
  try {
    const host = new URL(u).hostname.replace(/^www\./, "");
    const { data: comps } = await sb.from("companies").select("id, domain");
    companyId = (comps ?? []).find((c: { id: string; domain: string | null }) => c.domain && (host.includes(c.domain) || c.domain.includes(host)))?.id ?? null;
  } catch {}

  const title = ex.title?.trim() || u;
  const { data: post, error } = await sb.from("posts").insert({
    company_id: companyId, title, url: u, category, tags,
    source: "direct", author_id: user.id,
    ai_summary: { problem: s.problem || "", solution: s.solution || "", learning: s.learning || "" },
    body: ex.body, parsed: ex.parsed, published_at: new Date().toISOString(),
  }).select("id").single();
  if (error || !post) return { error: error?.message || "글 저장에 실패했어요" };

  // 등록자의 인사이트
  await sb.from("reviews").insert({
    post_id: post.id, author_id: user.id, q1: q1.trim(), q2: q2.trim(), q3: q3.trim(), is_draft: false,
  });

  revalidateTag("posts"); // 캐시된 글 목록 즉시 갱신
  revalidatePath("/home");
  revalidatePath("/feed");
  revalidatePath("/insight");
  return { ok: true, postId: post.id };
}
