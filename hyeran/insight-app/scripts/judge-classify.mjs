// 분류 판정 배치 + 검증 리포트  [분류체계_적용_지시서.md §8]
//
//   node scripts/judge-classify.mjs                # 판정만 (DB 기록 없음)
//   APPLY=1 node scripts/judge-classify.mjs        # posts 에 기록 (마이그레이션 016 필요)
//   LIMIT=30 …                                     # 파일럿
//   APPLY=1 SKIP_DONE=1 …                          # headline 이 이미 있는 글은 건너뜀
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { createClient } from "@supabase/supabase-js";
import {
  classify, bodyToText, certaintyRank,
  ARTICLE_KINDS, PROBLEM_TYPES, IMPACT_TARGETS, FLAGS,
} from "./classify-spec.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const env = fs.readFileSync(path.join(__dirname, "..", ".env.local"), "utf8");
const get = (k) => { const m = env.match(new RegExp("^" + k + "=(.*)$", "m")); return m ? m[1].trim() : null; };
const sb = createClient(get("NEXT_PUBLIC_SUPABASE_URL"), get("SUPABASE_SERVICE_ROLE_KEY"));
const genAI = new GoogleGenerativeAI(get("GEMINI_API_KEY"));
const model = genAI.getGenerativeModel({
  model: get("GEMINI_MODEL") || "gemini-flash-lite-latest",
  generationConfig: { responseMimeType: "application/json" },
});

const LIMIT = Number(process.env.LIMIT || 9999);
const APPLY = process.env.APPLY === "1";
const SKIP_DONE = process.env.SKIP_DONE === "1";
const REPORT = process.env.REPORT || path.join(__dirname, "..", "classify-report.json");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) + "%" : "-");

const cols = "id, title, body, companies(name)" + (SKIP_DONE ? ", headline" : "");
const { data: all, error } = await sb.from("posts").select(cols)
  .order("published_at", { ascending: false }).limit(2000);
if (error) { console.log("조회 실패:", error.message); process.exit(1); }

// 기업이 골고루 섞이도록 라운드로빈 (§8 ①)
const pool = all.filter((p) => !(SKIP_DONE && p.headline));
const byCo = new Map();
for (const p of pool) {
  const k = p.companies?.name || "기타";
  if (!byCo.has(k)) byCo.set(k, []);
  byCo.get(k).push(p);
}
const queues = [...byCo.values()];
const targets = [];
for (let i = 0; targets.length < LIMIT; i++) {
  let moved = false;
  for (const q of queues) { if (q[i]) { targets.push(q[i]); moved = true; if (targets.length >= LIMIT) break; } }
  if (!moved) break;
}

console.log(`전체 ${all.length}건 · 대상 ${targets.length}건 (기업 ${byCo.size}곳)`);
console.log(APPLY ? "모드: DB 기록\n" : "모드: 판정만 (DB 기록 없음)\n");

const results = [];
for (const [i, p] of targets.entries()) {
  // 원문 수집에 실패한 글은 판정해도 근거가 없다. AI를 태우지 않는다.
  const short = bodyToText(p.body).length < 300;
  const r = short ? { ok: true, skipped: true } : await classify({ title: p.title, body: p.body, model });
  const row = { id: p.id, title: p.title, company: p.companies?.name || "-", short, ...r };
  results.push(row);

  // 판정 실패 시 아무것도 쓰지 않는다 — 일시적 오류가 멀쩡한 기존 데이터를 지우면 안 된다
  if (APPLY && r.ok && !short) {
    const patch = {
      article_kind: r.article_kind, problem_type: r.problem_type,
      impact_targets: r.impact_targets, result_certainty: r.result_certainty,
      flags: r.flags, headline: r.headline, terms: r.terms, ai_summary: r.ai_summary,
    };
    for (let a = 1; a <= 3; a++) {
      const { error: e } = await sb.from("posts").update(patch).eq("id", p.id);
      if (!e) break;
      if (a === 3) console.log(`  ✗ 기록 실패 — ${e.message}`);
      else await sleep(2000 * a);
    }
  }
  const tag = short ? "(본문 없음 · 건너뜀)" : r.ok ? "" : "(판정 실패)";
  console.log(`${String(i + 1).padStart(3)}/${targets.length} ${(r.article_kind || "—").padEnd(5)} ${(r.problem_type || "—").padEnd(11)} ${r.result_certainty || "—"} ${row.company} · ${p.title.slice(0, 26)} ${tag}`);
  if (!short) await sleep(4500); // Gemini 무료 한도(분당 15회)
}

// ── §8 ① 결과 표 20줄 ────────────────────────────────────────
const judged = results.filter((r) => r.ok && !r.skipped);
const seen = new Map(), table = [];
for (const r of judged) { const n = seen.get(r.company) || 0; if (n < 2 && table.length < 20) { table.push(r); seen.set(r.company, n + 1); } }
for (const r of judged) { if (table.length >= 20) break; if (!table.includes(r)) table.push(r); }

console.log("\n\n────────── §8 ① 결과 표 20줄 ──────────\n");
console.log("| 원제목 | headline | kind | problem_type | impact_targets | 확실성 | flags |");
console.log("|---|---|---|---|---|---|---|");
table.slice(0, 20).forEach((r) => console.log(
  `| ${r.title.slice(0, 24)} | ${r.headline || "—"} | ${r.article_kind} | ${r.problem_type || "—"} | ${r.impact_targets.join(", ") || "—"} | ${r.result_certainty} | ${r.flags.join(", ") || "—"} |`));

const N = judged.length;
const none = judged.filter((r) => r.result_certainty === "없음").length;
const nullPt = judged.filter((r) => !r.problem_type).length;
console.log(`\n────────── §8 ② 숫자 둘 ──────────`);
console.log(`result_certainty '없음' : ${none}/${N} = ${pct(none, N)}   (정상 15~25% · 5% 아래면 지어내는 중)`);
console.log(`problem_type null      : ${nullPt}/${N} = ${pct(nullPt, N)}   (10% 아래여야 정상)`);

const line = (a, b, c = "") => console.log(String(a).padEnd(24) + String(b).padStart(9) + "  " + c);
console.log(`\n── article_kind ──`);
ARTICLE_KINDS.forEach((k) => { const n = judged.filter((r) => r.article_kind === k).length; line(k, `${n} (${pct(n, N)})`); });
console.log(`\n── problem_type ──`);
PROBLEM_TYPES.map((t) => [t, judged.filter((r) => r.problem_type === t).length]).sort((a, b) => b[1] - a[1])
  .forEach(([t, n]) => line(t, `${n} (${pct(n, N)})`, n === 0 ? "← 0편" : ""));
console.log(`\n── impact_targets (복수) ──`);
IMPACT_TARGETS.forEach((t) => { const n = judged.filter((r) => r.impact_targets.includes(t)).length; line(t, `${n} (${pct(n, N)})`); });
console.log(`\n── flags (복수) ──`);
FLAGS.forEach((f) => { const n = judged.filter((r) => r.flags.includes(f)).length; line(f, `${n} (${pct(n, N)})`, f === "직접 만들기" && n / N > 0.5 ? "← 절반 초과, 조건이 느슨" : ""); });
console.log();
line("headline 없음", judged.filter((r) => !r.headline).length);
line("headline 30자 초과", judged.filter((r) => (r.headline || "").length > 30).length);
line("terms 있는 글", judged.filter((r) => r.terms?.length).length);
line("본문 없어 건너뜀", results.filter((r) => r.skipped).length);
line("판정 실패", results.filter((r) => !r.ok).length);

// 홈 큐레이션 섹션이 실제로 뜨는지 (§8 ③) — 후보 6편 이상이어야 노출
console.log(`\n── 홈 섹션 후보 수 (6편 이상이어야 노출) ──`);
const secs = [
  ["AI, 다들 실제로는 이렇게 쓰고 있어요", (r) => r.flags.includes("개발 과정에 AI") || r.problem_type === "AI 출력 통제"],
  ["사용자가 느끼는 게 달라졌어요", (r) => r.impact_targets.includes("사용자 경험") && r.result_certainty !== "없음"],
  ["생각대로 안 됐을 때, 이렇게 했대요", (r) => r.flags.includes("기대와 다른 결과")],
  ["사서 쓰는 대신 직접 만들기로 했어요", (r) => r.flags.includes("직접 만들기")],
  ["손으로 하던 일을 없앤 사례", (r) => ["운영·어드민", "개발 생산성"].includes(r.problem_type) && r.impact_targets.includes("내부 생산성")],
];
const used = new Set();
for (const [name, fn] of secs) {
  const cands = judged.filter((r) => fn(r) && !used.has(r.id));
  const ok = cands.length >= 6;
  if (ok) cands.slice(0, 8).forEach((r) => used.add(r.id));
  console.log(`  ${ok ? "○" : "✗"} ${name.padEnd(30)} ${String(cands.length).padStart(3)}편${ok ? "" : "  ← 숨김"}`);
}

fs.writeFileSync(REPORT, JSON.stringify({ sampled: N, applied: APPLY, none, nullPt, results }, null, 2));
console.log(`\n리포트: ${REPORT}`);
