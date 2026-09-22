/**
 * 읽기 가이드 일괄 생성 — `summarize` 엣지 함수의 guide 단계를 글마다 호출한다.
 *
 *   node scripts/guide.mjs            # 가이드가 없거나 옛 형식인 글만 (기본 10건)
 *   node scripts/guide.mjs --limit 5
 *   node scripts/guide.mjs --all      # 이미 v3 인 글까지 전부 다시
 *   node scripts/guide.mjs --match 탐색하는   # 제목에 그 말이 든 **글 하나만**
 *
 * ⚠️ 구성을 다듬는 중이라면 `--match` 로 **한 글만** 돌린다.
 *    프롬프트를 고칠 때마다 열 건씩 다시 만들면 하루치 토큰이 오후에 사라진다(실제로 그랬다).
 *    구성이 확실해진 다음에 여러 건으로 넓힌다.
 *
 * 왜 필요한가: 가이드는 지금까지 **사람이 글을 열 때 한 건씩** 만들어졌다.
 * 그래서 아무도 안 연 글은 영원히 요약이 없고, 목록에서는 그게 "왜 얘만 되지?"로 보인다.
 * 미리 만들어두려면 배치가 있어야 한다.
 *
 * ⚠️ 한 건에 **약 7,000 토큰**이 든다 — LLM 을 **두 번** 부르기 때문이다.
 *    1단계(≈3,400): 블록 앞부분만 보고 뼈대(한눈에 · 소제목 · 근거 블록)를 잡는다.
 *    2단계(≈3,600): 1단계가 고른 **블록의 전문**을 읽고 소제목의 답을 다시 쓴다.
 *    1단계만으로는 본문의 44%, 그나마 문단 앞 140자만 보여서 "더 들어가 볼까요"가 얕았다.
 *    Groq 무료 티어는 **하루 20만 토큰**이라 하루에 소화되는 게 대략 **25~28건**이다.
 *    가이드는 글에 한 번만 만들어 **모두가 같은 저장본을 읽는다** — 이 비용은 글당 1회다.
 *    분류(`classify.mjs`)와 **같은 한도를 나눠 쓴다** — 둘 다 돌리면 그만큼 줄어든다.
 *    끊어도 안전하다 — 다시 돌리면 아직 안 된 글부터 이어서 한다.
 *
 * 필요한 것: .env 의 EXPO_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY
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
  console.error(".env 에 EXPO_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 있어야 합니다.");
  process.exit(1);
}

const args = process.argv.slice(2);
const all = args.includes("--all");
/** 제목에 이 말이 든 글만 — 구성을 다듬는 동안 한 글로 확인하려고. */
const match = args.includes("--match") ? args[args.indexOf("--match") + 1] : null;
/**
 * 기본 10건. 작게 잡는 이유 — 한 건이 7,000 토큰이라 10건이면 **하루 치의 1/3**이다.
 * 먼저 작게 돌려 결과를 눈으로 보고, 멀쩡하면 --limit 을 올린다.
 * (예전에 500건을 한 번에 돌렸다가 버그로 전부 실패해 그날 치를 통째로 태웠다.)
 */
const limit = Number(args[args.indexOf("--limit") + 1]) || 10;
// 한 건이 크다. 분당 8,000 토큰 한도에 맞춰 넉넉히 띄운다.
const gapMs = Number(args[args.indexOf("--gap") + 1]) || 20000;

const headers = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** v3 가이드인가 — `lead` 가 있어야 앱이 읽을 수 있다(v1 steps · v2 points 는 못 읽는다). */
const isV3 = (g) => !!g && typeof g === "object" && !!g.lead && typeof g.lead.what === "string";

async function listArticles() {
  // 가이드 유무를 JSON 경로로 거르는 건 PostgREST 문법이 까다롭다 —
  // 넉넉히 받아 **여기서** 판별한다. 목록 조회는 토큰을 쓰지 않으니 싸다.
  // --match 는 제목으로 한 건만 집는다(구성 다듬는 중). 그때는 가이드 유무를 안 따진다.
  const q = match
    ? `title=like.*${encodeURIComponent(match)}*&limit=1`
    : `order=published_at.desc&limit=300`;
  const res = await fetch(`${URL_BASE}/rest/v1/articles?select=id,title,reading_guide&${q}`, {
    headers,
  });
  if (!res.ok) throw new Error(`목록 조회 실패: ${res.status} ${await res.text()}`);
  const rows = await res.json();
  if (match) return rows;
  return rows.filter((a) => all || !isV3(a.reading_guide)).slice(0, limit);
}

const rows = await listArticles();
const mins = Math.round((rows.length * gapMs) / 60000);
console.log(
  `대상 ${rows.length}건 (${match ? `제목에 "${match}"` : all ? "전부 다시" : "가이드 없음·옛 형식"}) · 간격 ${gapMs}ms · 약 ${mins}분 예상\n` +
    `예상 토큰 ≈ ${(rows.length * 7000).toLocaleString()} (무료 티어 하루 200,000)\n` +
    "중간에 끊어도 됩니다 — 다시 돌리면 아직 안 된 글부터 이어서 해요.\n",
);

let ok = 0;
let failed = 0;
const reasons = {};

for (const [i, a] of rows.entries()) {
  const head = `${String(i + 1).padStart(3)}/${rows.length}`;
  try {
    const res = await fetch(`${URL_BASE}/functions/v1/summarize`, {
      method: "POST",
      headers,
      body: JSON.stringify({ article_id: a.id, target: "guide" }),
    });
    const r = await res.json();
    if (r.ok) {
      ok++;
      // deepened = 2단계에서 **원문 전문을 읽고 다시 쓴** 소제목 수.
      // 0 이면 1단계 답이 그대로 남은 것이라(얕다) 이유를 같이 찍는다.
      const deep = r.deepened > 0 ? `깊게 ${r.deepened}개` : `깊게 0 (${r.deepReason ?? "?"})`;
      console.log(
        `${head} 성공  [${r.model ?? "?"}] 소제목 ${r.sections}개 · ${deep} · 용어 ${r.terms}개 · ${a.title.slice(0, 28)}`,
      );
    } else {
      failed++;
      const full = String(r.reason ?? "?");
      const why = full.slice(0, 60);
      reasons[why] = (reasons[why] ?? 0) + 1;
      console.log(`${head} 실패  ${why} · ${a.title.slice(0, 30)}`);
      // 하루 한도가 끝났으면 더 돌려봐야 전부 실패한다 — 바로 멈춘다.
      // ⚠️ 잘라낸 why 가 아니라 **전문**을 본다. TPD 라는 말은 메시지 한참 뒤에 나온다.
      if (full.includes("TPD") || full.includes("tokens per day")) {
        console.log("\n⚠️ 하루 토큰 한도(TPD)를 다 썼습니다. 내일 이어서 돌리세요.");
        break;
      }
    }
  } catch (e) {
    failed++;
    console.log(`${head} 오류  ${String(e).slice(0, 60)}`);
  }
  if (i < rows.length - 1) await sleep(gapMs);
}

console.log("\n=== 결과 ===");
console.log(`  ${String(ok).padStart(4)}  성공`);
console.log(`  ${String(failed).padStart(4)}  실패`);
for (const [why, n] of Object.entries(reasons).sort((a, b) => b[1] - a[1])) {
  console.log(`        ${String(n).padStart(3)}회  ${why}`);
}
