// "스택 심화" 플래그만 따로 판정한다.
//
// 왜 따로 두냐면 — 전체 판정(judge-classify)은 글 하나마다 AI를 한 번씩 부르고
// 무료 한도 때문에 4.5초씩 쉬어서 347건에 30분이 걸린다.
// 이 플래그는 제목·요약만 보면 판단할 수 있으므로 20건씩 묶어 한 번에 물어본다.
// 같은 347건이 20번 남짓의 호출로 끝나 2~3분이면 된다.
//
//   node scripts/flag-stack-deep.mjs           # 판정만 (DB 기록 없음)
//   APPLY=1 node scripts/flag-stack-deep.mjs   # posts.flags 에 반영
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
const model = genAI.getGenerativeModel({
  model: get("GEMINI_MODEL") || "gemini-flash-lite-latest",
  generationConfig: { responseMimeType: "application/json" },
});

const FLAG = "스택 심화";
const CHUNK = 20;
const APPLY = process.env.APPLY === "1";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function buildPrompt(items) {
  const list = items.map((p, i) =>
    `[${i + 1}] 제목: ${p.title}\n    무슨 문제: ${(p.ai_summary?.problem ?? "").slice(0, 160)}\n    어떻게: ${(p.ai_summary?.implementation ?? p.ai_summary?.decision ?? "").slice(0, 160)}`
  ).join("\n\n");

  return `아래 글 목록에서 "스택 심화"에 해당하는 것을 골라라.

판정 질문은 하나다:
  "그 기술을 안 쓰는 사람이 읽어서 가져갈 게 있는가?"
  없으면 스택 심화다.

스택 심화인 경우
  - 특정 기술 이름(프레임워크·언어·라이브러리·미들웨어·DB·프로토콜)이
    제목이나 본론에 나오고, 그 기술을 쓰는 사람만 이해할 수 있는 내용
  - 코드 설계·아키텍처 패턴·동작 원리·성능 튜닝·마이그레이션 방법이 본론
  예: App Router 도입 / Airflow 멀티프로세싱 / Kafka Streams 이관 /
      디자인 패턴 적용 / KMP 마이그레이션 / 헥사고날 아키텍처 / 제네릭 문법

스택 심화가 아닌 경우
  - 만드는 과정에 AI를 쓴 이야기 (스택을 몰라도 읽을 값이 있다)
  - 기술 이름이 나와도 결정·조직·일하는 방식이 본론인 경우
  - 사용자에게 무엇이 달라졌는지가 본론인 경우

애매하면 스택 심화로 본다. 읽을 글은 이미 충분히 많다.
단, 사용자에게 무엇이 달라졌는지가 본문에 있으면 남겨라.
그 글은 기술 이름이 나와도 읽을 값이 있다.

【글 목록】
${list}

【출력】 스택 심화에 해당하는 글의 번호만 배열로. 없으면 빈 배열.
{ "deep": [1, 4, 7] }`;
}

const { data: posts, error } = await sb
  .from("posts")
  .select("id, title, flags, ai_summary, impact_targets, result_certainty")
  .order("published_at", { ascending: false });
if (error) { console.log("조회 실패:", error.message); process.exit(1); }

const chunks = [];
for (let i = 0; i < posts.length; i += CHUNK) chunks.push(posts.slice(i, i + CHUNK));
console.log(`전체 ${posts.length}건 · ${chunks.length}묶음 (묶음당 ${CHUNK}건)`);
console.log(APPLY ? "모드: DB 기록\n" : "모드: 판정만 (DB 기록 없음)\n");

const deepIds = new Set();
let failed = 0;
for (const [ci, chunk] of chunks.entries()) {
  let picked = null;
  for (let a = 1; a <= 3 && !picked; a++) {
    try {
      const res = await model.generateContent(buildPrompt(chunk));
      const j = JSON.parse(res.response.text());
      if (Array.isArray(j.deep)) picked = j.deep;
    } catch { if (a < 3) await sleep(3000 * a); }
  }
  if (!picked) { console.log(`  ✗ ${ci + 1}번 묶음 판정 실패 — 건너뜀`); failed++; continue; }
  picked.forEach((n) => { const p = chunk[n - 1]; if (p) deepIds.add(p.id); });
  console.log(`${String(ci + 1).padStart(2)}/${chunks.length}  ${picked.length}건 골라냄`);
  await sleep(4500); // 무료 한도(분당 15회)
}

// 예외는 코드로 건다.
// AI 에게는 제목·요약만 보내므로 "이 글에 개발 과정에 AI 가 붙어 있는지",
// "사용자에게 뭐가 달라졌는지"를 모른 채 판단한다.
// 그 두 가지는 DB 에 이미 있으니 프롬프트에 맡기지 말고 여기서 확실하게 뺀다.
let freed = 0;
for (const p of posts) {
  if (!deepIds.has(p.id)) continue;
  const madeWithAI = p.flags?.includes("개발 과정에 AI");
  const userImpact = p.impact_targets?.includes("사용자 경험") && p.result_certainty !== "없음";
  if (madeWithAI || userImpact) { deepIds.delete(p.id); freed++; }
}

console.log(`\n예외로 제외: ${freed}건 (개발 과정에 AI · 사용자에게 달라진 게 있는 글)`);
console.log(`스택 심화: ${deepIds.size}/${posts.length}건 (${Math.round(deepIds.size / posts.length * 100)}%)` + (failed ? ` · 실패 묶음 ${failed}` : ""));

if (APPLY) {
  let changed = 0;
  for (const p of posts) {
    const had = p.flags?.includes(FLAG) ?? false;
    const should = deepIds.has(p.id);
    if (had === should) continue;
    const next = should
      ? [...(p.flags ?? []), FLAG]
      : (p.flags ?? []).filter((f) => f !== FLAG);
    const { error: e } = await sb.from("posts").update({ flags: next }).eq("id", p.id);
    if (e) console.log(`  ✗ ${p.title.slice(0, 30)} — ${e.message}`);
    else changed++;
  }
  console.log(`flags 갱신 ${changed}건`);
}

console.log("\n── 골라낸 글 (앞 20) ──");
posts.filter((p) => deepIds.has(p.id)).slice(0, 20).forEach((p) => console.log(`  ${p.title.slice(0, 52)}`));
console.log("\n── 남는 글 (앞 12) ──");
posts.filter((p) => !deepIds.has(p.id)).slice(0, 12).forEach((p) => console.log(`  ${p.title.slice(0, 52)}`));
