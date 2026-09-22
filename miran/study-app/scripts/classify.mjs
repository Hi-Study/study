/**
 * 대분류·태그 일괄 채우기 — `summarize` 엣지 함수의 classify 단계를 글마다 호출한다.
 *
 *   node scripts/classify.mjs          # 아직 분류 안 된 글만 (기본)
 *   node scripts/classify.mjs --all    # 전부 다시 판정
 *   node scripts/classify.mjs --limit 30
 *
 * 왜 스크립트인가: classify 는 한 글에 LLM 을 2~3번 부른다(판정 + 다수결).
 * 수집 한 번에 글 수십 건이 들어오므로 수집 안에 넣으면 타임아웃이 난다.
 * 크론으로 조금씩 돌려도 되지만(`supabase/distill_cron.sql`), 기준이 바뀌어 **한 번에 다시
 * 판정해야 할 때**는 이 스크립트가 필요하다. 기준 v1 도입이 딱 그 경우다.
 *
 * ⚠️ Groq 무료 티어는 분당 8,000 토큰이다. 글 하나가 2~3회 호출이라 **간격을 둔다**(기본 15초).
 *    빨리 돌리면 429 가 나고, 재시도까지 겹쳐 오히려 더 느려진다.
 *    끊어도 안전하다 — 다시 돌리면 `topic` 이 빈 글부터 이어서 한다.
 *
 * 필요한 것: .env 의 EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
 *   (service role 이 필요한 이유 — articles 는 RLS 로 anon 읽기가 막혀 있다)
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const URL_BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !SERVICE) {
  console.error(
    ".env 에 EXPO_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 있어야 합니다.\n" +
      "service role 키는 Supabase 대시보드 > Settings > API 에서 확인할 수 있어요.",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const all = args.includes("--all");
/**
 * 기본 20건. 크게 잡지 않는 이유 — Groq 무료 티어는 **하루 20만 토큰**이고,
 * 글 하나가 2~3회 호출이라 하루에 소화되는 게 대략 40~60건이다.
 * 게다가 실패해도 토큰은 나간다(추론형 모델은 생각한 토큰까지 센다).
 * 한 번에 크게 돌렸다가 버그로 전부 실패하면 **그날 치를 통째로 태운다** — 실제로 그랬다.
 * 먼저 작게 돌려 결과를 보고, 멀쩡하면 --limit 을 올린다.
 */
const limit = Number(args[args.indexOf("--limit") + 1]) || 20;
// 글 하나에 LLM 을 2~3번 부른다. Groq 무료 티어(분당 8,000 토큰)에 맞춘 간격이다.
// 너무 좁히면 429 가 나고, 재시도까지 겹쳐 오히려 더 느려진다.
const gapMs = Number(args[args.indexOf("--gap") + 1]) || 15000;

const headers = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function listArticles() {
  const filter = all ? "" : "&topic=is.null";
  const res = await fetch(
    `${URL_BASE}/rest/v1/articles?select=id,title&order=published_at.desc&limit=${limit}${filter}`,
    { headers },
  );
  if (!res.ok) throw new Error(`목록 조회 실패: ${res.status} ${await res.text()}`);
  return res.json();
}

const rows = await listArticles();
const mins = Math.round((rows.length * gapMs) / 60000);
console.log(
  `대상 ${rows.length}건 (${all ? "전부 다시" : "미분류만"}) · 간격 ${gapMs}ms · 약 ${mins}분 예상\n` +
    "중간에 끊어도 됩니다 — 다시 돌리면 아직 안 된 글부터 이어서 해요.\n",
);

const tally = {};
let excluded = 0;
let failed = 0;

for (const [i, a] of rows.entries()) {
  const head = `${String(i + 1).padStart(3)}/${rows.length}`;
  try {
    const res = await fetch(`${URL_BASE}/functions/v1/summarize`, {
      method: "POST",
      headers,
      body: JSON.stringify({ article_id: a.id, target: "classify" }),
    });
    const r = await res.json();
    if (r.ok && r.topic) {
      tally[r.topic] = (tally[r.topic] ?? 0) + 1;
      console.log(`${head} ${r.topic.padEnd(13)} ${r.purpose ?? "-"} · ${a.title.slice(0, 40)}`);
    } else if (r.ok && r.include === false) {
      excluded++;
      console.log(`${head} ${"제외".padEnd(13)} ${a.title.slice(0, 40)}`);
    } else {
      failed++;
      console.log(`${head} ${"실패".padEnd(13)} ${r.reason ?? "?"} · ${a.title.slice(0, 30)}`);
    }
  } catch (e) {
    failed++;
    console.log(`${head} 오류 ${String(e).slice(0, 60)}`);
  }
  // 마지막 건 뒤에는 기다리지 않는다.
  if (i < rows.length - 1) await sleep(gapMs);
}

console.log("\n=== 결과 ===");
for (const [k, v] of Object.entries(tally).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${String(v).padStart(4)}  ${k}`);
}
console.log(`  ${String(excluded).padStart(4)}  제외(주제 비움)`);
console.log(`  ${String(failed).padStart(4)}  실패(다수결 불성립·LLM 오류 — 다시 돌리면 채워진다)`);
