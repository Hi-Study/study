// 기존 글의 category 를 11개 체계로 재분류 (Gemini). migration 005 실행 후 돌리세요.
// (005 미실행이면 CHECK 제약 위반으로 update 가 실패합니다.)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const get = (k) => { const m = env.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].trim() : null; };
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));
const genAI = new GoogleGenerativeAI(get("GEMINI_API_KEY"));
const model = genAI.getGenerativeModel({ model: get("GEMINI_MODEL") || "gemini-flash-lite-latest", generationConfig: { responseMimeType: "application/json" } });
const CATS = ["프로덕트", "UIUX", "디자인", "AI", "비즈니스", "데이터 분석", "프론트엔드", "백엔드", "데이터베이스", "보안", "모바일"];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function classify(title, summary, tags) {
  const prompt = `기술 블로그 글을 다음 11개 중 정확히 하나로 분류해 JSON으로만 답해.
카테고리: ${CATS.map((c) => `"${c}"`).join(" | ")}
(UIUX=화면·플로우·사용성·인터랙션 / 디자인=비주얼·브랜드·디자인시스템 / 프로덕트=기획·그로스·의사결정 / 비즈니스=사업·전략·조직)
출력: {"category":"..."}
제목: ${title}
요약: ${summary}
태그: ${(tags || []).join(", ")}`;
  const r = await model.generateContent(prompt);
  const j = JSON.parse(r.response.text());
  return CATS.includes(j.category) ? j.category : "프론트엔드";
}

const { data: posts } = await sb.from("posts").select("id, title, category, ai_summary, tags");
console.log("대상:", posts?.length || 0);
let updated = 0, failed = 0;
for (const p of posts || []) {
  try {
    const summary = [p.ai_summary?.problem, p.ai_summary?.solution, p.ai_summary?.learning].filter(Boolean).join(" ");
    const cat = await classify(p.title, summary, p.tags);
    const { error } = await sb.from("posts").update({ category: cat }).eq("id", p.id);
    if (error) { console.log(`  ✗ ${p.title.slice(0, 30)} — ${error.message}`); failed++; }
    else { console.log(`  ✓ ${p.category} → ${cat}  ${p.title.slice(0, 34)}`); updated++; }
    await sleep(4500); // Gemini 무료 한도 대비
  } catch (e) { console.log(`  ✗ ${e.message.slice(0, 50)}`); failed++; }
}
console.log(`\n완료 — 업데이트 ${updated} · 실패 ${failed}`);
