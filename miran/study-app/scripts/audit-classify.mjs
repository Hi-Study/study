/**
 * 분류 감사 — **붙어 있는 분류가 맞는지 직접 재본다.**
 *
 *   node scripts/audit-classify.mjs            # 기계 검증만 (토큰 0)
 *   node scripts/audit-classify.mjs --cross 12 # + LLM 에게 다시 물어 내 판정과 대조
 *   node scripts/audit-classify.mjs --cross 12 --version v1-claude   # 내가 손으로 넣은 것만
 *   node scripts/audit-classify.mjs --ids a1b2,c3d4                  # 고른 글만 (망설였던 건)
 *   node scripts/audit-classify.mjs --verify 20                     # 근거가 그 칸을 가리키는지
 *
 * ⚠️ 표본을 고르게 뽑으면 **쉬운 글만 맞히고 100% 가 나온다** — 실측: 10건 중 6건이
 *    AWS 인프라 가이드라 판단이 갈릴 여지가 없었다. 경계에 있던 글은 `--ids` 로 따로 재라.
 *
 * ⚠️ **기계는 O/X 를 내고, 뜻은 판정하지 않는다.**
 *    예전 감사 스크립트가 "문제 어휘 목록"으로 뜻을 판정하려다 멀쩡한 글을 0/5 로 깎았다
 *    (`막막함`·`한계` 가 목록에 없다는 이유로). 그래서 여기서 O/X 를 내는 건
 *    **문자열로 확인되는 것**뿐이다 — 어휘에 있나, 본문에 있나, 빈 칸인가.
 *    뜻이 맞는지는 `--cross` 가 LLM 에게 **다시 물어** 불일치만 사람 앞에 꺼내 놓는다.
 *    불일치가 곧 오답이라는 뜻은 아니다. 어느 쪽이 맞는지는 근거 문장을 보고 정한다.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import process from "node:process";

// ⚠ URL.pathname 은 퍼센트 인코딩된다 — 경로에 한글·공백이 있어서 그대로 쓰면 파일을 못 찾는다.
const ROOT = fileURLToPath(new URL("..", import.meta.url));
const env = Object.fromEntries(
  readFileSync(`${ROOT}/.env`, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const U = env.EXPO_PUBLIC_SUPABASE_URL;
const K = env.SUPABASE_SERVICE_ROLE_KEY;
if (!U || !K) throw new Error(".env 에 EXPO_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요해요");
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };

const args = process.argv.slice(2);
const cross = args.includes("--cross") ? Number(args[args.indexOf("--cross") + 1]) || 10 : 0;
const onlyVersion = args.includes("--version") ? args[args.indexOf("--version") + 1] : null;
/** 고른 글만 대조한다 — 쉬운 표본으로 100% 를 받는 것보다 경계 한 건이 더 많이 알려준다. */
/**
 * `--verify N` — **이 글이 진짜 그 대분류인가**를 잰다.
 *
 * 근거 문장 하나만 떼어 주고 "이건 어느 칸이냐"고 되묻는다(붙어 있는 칸은 알려주지 않는다).
 * 맞히면 근거가 그 칸을 실제로 가리키는 것이고, 어긋나면 근거가 약하거나 분류가 틀린 것이다.
 * 본문을 안 보내므로 `--cross` 보다 훨씬 싸다.
 */
const verifyN = args.includes("--verify") ? Number(args[args.indexOf("--verify") + 1]) || 20 : 0;
const onlyIds = args.includes("--ids") ? (args[args.indexOf("--ids") + 1] ?? "").split(",").filter(Boolean) : null;

/** 목적 어휘 v2 — 정본은 supabase/functions/_shared/classify.ts 다. 여기서 **읽어온다**(두 벌이 되지 않게). */
const PURPOSE = (() => {
  const src = readFileSync(`${ROOT}/supabase/functions/_shared/classify.ts`, "utf8");
  const m = src.match(/purpose:\s*\[([\s\S]*?)\]/);
  if (!m) throw new Error("classify.ts 에서 purpose 어휘를 못 찾았어요");
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
})();

const CATEGORY = {
  quality_risk: "품질·위험 관리",
  ai_use: "AI 활용",
  product_plan: "제품·서비스 기획",
  data_exp: "데이터·실험",
  user_exp: "사용자 이해·경험",
  biz_brand: "사업·브랜드",
  collab: "협업·프로세스",
};
/** 사용자를 향한 목적 — 조직·문화 글(협업·프로세스)에 이게 붙어 있으면 의심한다. */
const USER_SIDE = ["유입", "첫 사용", "전환", "재방문", "사용성", "접근성"];

/**
 * **글에 대한 글** — 근거로 쓰면 안 되는 문장.
 *
 * "이 글에서는 ~를 살펴봅니다", "도움이 되었으면 좋겠습니다" 같은 문장은 글이 **무엇을 했는지**가
 * 아니라 **무엇을 쓸 것인지**를 말한다. 어느 글에나 있어서 대분류를 가르지 못한다.
 * 실측: 경계 6건을 다시 물었더니 어긋난 4건 중 3건이 이런 문장을 근거로 삼은 것이었다
 * (그 3건은 전부 오판이었다).
 *
 * ⚠️ 걸렸다고 곧 오답은 아니다 — 새 서비스를 "소개합니다"가 정말 결론인 글도 있다.
 *    그래서 O/X 가 아니라 **다시 볼 것**으로 내놓는다.
 */
const META_SENTENCE = [
  /(이|이번|본|해당)\s*(글|포스팅|아티클|편)(에서(는)?|을|를)/,
  // ⚠ 정본은 supabase/functions/_shared/classify.ts 의 isMetaSentence 다. 같은 꼴을 유지한다.
  // ⚠ 어미는 **예고형만** 잡는다. `했습니다`까지 넣었더니
  //   "프로젝트를 시작했습니다" 같은 **실제로 한 일**까지 걸렸다(실측 6건 중 4건이 오탐).
  /(소개|공유|정리|설명|살펴|알아|다뤄|풀어)[^.]{0,9}?(하고자|하려고|해\s*보려고|해\s*보겠|보겠습니다|드리겠|하겠습니다|합니다)/,
  /(시작|이야기|여정|담아|짚어)[^.]{0,9}?(하고자|하려고|해\s*보려고|해\s*보겠|보겠습니다|드리겠|하겠습니다)/,
  /(도움이\s*되|참고가\s*되)[^.]{0,12}(좋겠|바랍)/,
  /(in|throughout)\s+this\s+(post|article|series)/i,
  /I\s+hope/i,
  /we('|’)?ll\s+(walk|cover|share|look)/i,
];

const all = [];
for (let from = 0; ; from += 1000) {
  const res = await fetch(
    `${U}/rest/v1/articles?select=id,title,body,topic,planner_included,planner_category,planner_evidence,planner_tags,planner_version,planner_votes&planner_version=not.is.null&order=id&limit=1000&offset=${from}`,
    { headers: H },
  );
  if (!res.ok) throw new Error(`목록 조회 실패: ${res.status} ${await res.text()}`);
  const page = await res.json();
  all.push(...page);
  if (page.length < 1000) break;
}
let rows = onlyVersion ? all.filter((r) => r.planner_version === onlyVersion) : all;
if (onlyIds) {
  rows = onlyIds.map((id) => {
    const hit = all.find((r) => r.id.startsWith(id));
    if (!hit) throw new Error(`--ids 에 준 ${id} 를 못 찾았어요`);
    return hit;
  });
}

// ── ① 기계 검증 — 문자열로 확인되는 것만 ────────────────────────
const issues = { 어휘밖: [], 제외인데남음: [], 채택인데빈칸: [], 라벨어긋남: [], 근거없음: [], 목적의심: [], 근거가메타: [], 표가갈림: [] };

for (const r of rows) {
  const inc = r.planner_included;
  const purpose = r.planner_tags?.purpose;

  if (purpose && !PURPOSE.includes(purpose)) issues.어휘밖.push([r, purpose]);

  if (inc === false) {
    if (r.topic || r.planner_category || r.planner_evidence) issues.제외인데남음.push([r, r.topic ?? r.planner_category]);
  } else if (inc === true) {
    if (!r.topic || !r.planner_category) issues.채택인데빈칸.push([r, `topic=${r.topic} cat=${r.planner_category}`]);
    else if (CATEGORY[r.topic] !== r.planner_category) issues.라벨어긋남.push([r, `${r.topic} ≠ ${r.planner_category}`]);

    // 근거는 **본문에 그대로 있어야** 한다 — 요약하거나 지어냈으면 여기서 걸린다.
    if (r.planner_evidence && r.body) {
      const e = r.planner_evidence.replace(/\s+/g, "");
      if (e.length >= 10 && !r.body.replace(/\s+/g, "").includes(e)) issues.근거없음.push([r, r.planner_evidence.slice(0, 50)]);
    }

    if (r.planner_category === "협업·프로세스" && USER_SIDE.includes(purpose)) issues.목적의심.push([r, purpose]);

    const ev = r.planner_evidence ?? "";
    const hit = META_SENTENCE.find((re) => re.test(ev));
    if (hit) issues.근거가메타.push([r, ev.replace(/\s+/g, " ").slice(0, 56)]);

    /**
     * 표가 갈렸거나 모델이 "하"(불분명)라고 한 글 — **틀렸다는 뜻이 아니라 약하다는 뜻**이다.
     * 다수결이 덮어 버린 자리라, 대분류를 손볼 때 여기부터 보면 된다. 토큰은 들지 않는다.
     */
    // ⚠️ votes 형식이 두 벌이다. 둘 다 읽는다:
    //   · 옛 형식(마이그레이션 0015, 사람이 검증한 245건) — "AI 활용 2, 제외 1" (집계)
    //   · 새 형식(v2-auto) — "ai_use(상),ai_use(중)" (판정 순서대로)
    // 어느 쪽이든 쉼표로 끊어 **서로 다른 값이 섞여 있으면** 표가 갈린 것이다.
    // 사람이 확정한 글(v*-claude)은 들추지 않는다 — 이미 정한 것을 계속 묻는 감사는 쓸모가 없다.
    const confirmed = (r.planner_version ?? "").endsWith("-claude");
    const votes = confirmed ? [] : (r.planner_votes ?? "").split(",").filter(Boolean);
    if (votes.length) {
      const kinds = new Set(votes.map((v) => v.replace(/\(.*\)$/, "")));
      if (kinds.size > 1 || votes.some((v) => v.endsWith("(하)"))) {
        issues.표가갈림.push([r, r.planner_votes]);
      }
    }
  }
}

/**
 * 분포를 찍는다 — **판정이 아니라 참고**다.
 *
 * ⚠️ 한 칸이 크다고 문제가 아니다. 그 칸에 해당하는 글이 실제로 많으면 많은 것이다
 *    (수집된 기술 블로그가 지금 온통 "AI 로 일하는 방식 바꾸기"다).
 *    한때 "35% 넘으면 경고"를 걸었다가 뗐다 — 근거 없는 숫자였고, 맞게 분류된 글까지 계속 걸렸다.
 *
 * 이 표가 쓸모 있는 순간은 **기준을 고친 직후**다. `v2 판정만` 줄이 전체와 크게 다르면
 * 새 기준이 한쪽으로 끌고 있다는 뜻이라, 그때 표본을 열어 보면 된다
 * (실측: 제외선을 넓히며 든 예시가 전부 제품 이야기여서 새 판정의 63%가 product_plan 이었다).
 */
function printDist(label, counts, total) {
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  console.log(`\n  ${label} — ${total}건`);
  for (const [k, v] of rows) {
    console.log(`      ${String(v).padStart(4)}  ${String(Math.round((v / total) * 100)).padStart(2)}%  ${k}`);
  }
}

const label = onlyVersion ? `${onlyVersion} ` : "";
console.log(`\n■ 기계 검증 — ${label}분류된 글 ${rows.length}건 (토큰 0)\n`);
const NAME = {
  어휘밖: "목적 태그가 어휘에 없음",
  제외인데남음: "제외인데 대분류·근거가 남아 있음",
  채택인데빈칸: "채택인데 대분류가 비어 있음",
  라벨어긋남: "topic 과 한글 라벨이 어긋남",
  근거없음: "근거 문장이 본문에 없음",
  목적의심: "협업·프로세스인데 목적이 사용자 쪽",
  근거가메타: "근거가 '글에 대한 글' — 다시 볼 것",
  표가갈림: "표가 갈렸거나 모델이 '하' — 약한 판정",
};
let bad = 0;
for (const [k, list] of Object.entries(issues)) {
  console.log(`  ${list.length ? "✖" : "○"} ${NAME[k].padEnd(30)} ${list.length}건`);
  bad += list.length;
  for (const [r, why] of list.slice(0, 6)) console.log(`      · ${r.title.slice(0, 40)}  — ${why}`);
  if (list.length > 6) console.log(`      … 그 밖 ${list.length - 6}건`);
}
console.log(`\n  ${bad === 0 ? "기계로 잡히는 어긋남은 없어요." : `합계 ${bad}건`}`);

// ── 분포 — 기준을 고친 뒤 **반드시** 본다 ─────────────────────────
const kept = rows.filter((r) => r.planner_included === true);
if (kept.length) {
  const tally = (f) => {
    const m = {};
    for (const r of kept) {
      const k = f(r);
      if (k) m[k] = (m[k] ?? 0) + 1;
    }
    return m;
  };
  console.log("\n■ 분포 — 참고용(판정 아님)");
  printDist("대분류", tally((r) => r.planner_category), kept.length);
  const withPurpose = kept.filter((r) => r.planner_tags?.purpose);
  if (withPurpose.length) {
    const m = {};
    for (const r of withPurpose) {
      const k = r.planner_tags.purpose;
      m[k] = (m[k] ?? 0) + 1;
    }
    printDist("목적 태그", m, withPurpose.length);
  }
  // 최근에 붙인 판정만 따로 — 기준을 고친 효과는 여기서 먼저 드러난다.
  const recent = kept.filter((r) => (r.planner_version ?? "").startsWith("v2"));
  if (recent.length >= 10) {
    const m = {};
    for (const r of recent) {
      const k = r.planner_category;
      if (k) m[k] = (m[k] ?? 0) + 1;
    }
    printDist("대분류 — v2 판정만", m, recent.length);
  }
}

if (verifyN) {
  const pool = rows.filter((r) => r.planner_included === true && r.planner_evidence);
  const pick = [];
  const step = Math.max(1, Math.floor(pool.length / verifyN));
  for (let i = 0; i < pool.length && pick.length < verifyN; i += step) pick.push(pool[i]);

  console.log(`\n■ 근거가 그 칸을 가리키는가 — ${pick.length}건 (근거 한 문장만 보낸다)\n`);
  let same = 0;
  const off = [];
  for (const [i, r] of pick.entries()) {
    const res = await fetch(`${U}/functions/v1/summarize`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ article_id: r.id, target: "verify" }),
    });
    const j = await res.json().catch(() => ({}));
    const head = `${String(i + 1).padStart(3)}/${pick.length}`;
    if (!j.ok) {
      console.log(`${head} …실패  ${(j.reason ?? "?").slice(0, 40)}  ${r.title.slice(0, 28)}`);
    } else if (j.agree) {
      same++;
      console.log(`${head} 같음   ${String(r.planner_category).padEnd(11)} ${r.title.slice(0, 32)}`);
    } else {
      off.push([r, j]);
      console.log(`${head} 다름   붙은칸=${String(r.planner_category).padEnd(11)} 근거로는=${String(CATEGORY[j.guess] ?? j.guess ?? "못 고름").padEnd(11)} (${j.confidence}) ${r.title.slice(0, 22)}`);
    }
    await new Promise((x) => setTimeout(x, 6000));
  }
  console.log(`\n=== 결과 ===\n  근거가 같은 칸을 가리킴 ${same} / ${pick.length}`);
  if (off.length) {
    console.log(`\n  어긋난 ${off.length}건 — 근거가 약한 건지 분류가 틀린 건지는 **근거를 보고** 정하세요.\n`);
    for (const [r, j] of off) {
      console.log(`  · ${r.title.slice(0, 52)}`);
      console.log(`      붙은 칸  ${r.planner_category}`);
      console.log(`      근거     ${(r.planner_evidence ?? "").replace(/\s+/g, " ").slice(0, 90)}`);
      console.log(`      이 문장만 읽으면  ${CATEGORY[j.guess] ?? "못 고르겠다"} (확신 ${j.confidence})`);
      console.log(`      ${r.id}`);
    }
  }
  console.log("");
  process.exit(0);
}

if (!cross && !onlyIds) {
  console.log("\n뜻이 맞는지는 기계가 못 재요. --cross 12 로 LLM 에게 다시 물어 대조하세요.\n");
  process.exit(0);
}

// ── ② 교차 검증 — 같은 글을 LLM 에게 다시 물어 대조 ─────────────
// 한 글에 LLM 을 2~3번 부른다. 간격을 두지 않으면 429 가 난다(Groq 분당 8,000 토큰).
const pool = rows.filter((r) => r.planner_included !== null);
let pick = [];
if (onlyIds) {
  pick = pool; // 고른 글은 전부 잰다
} else {
  const step = Math.max(1, Math.floor(pool.length / cross));
  for (let i = 0; i < pool.length && pick.length < cross; i += step) pick.push(pool[i]);
}

console.log(`\n■ 교차 검증 — ${pick.length}건을 LLM 에게 다시 묻습니다 (약 ${Math.round((pick.length * 15) / 60)}분)\n`);
let same = 0;
const diff = [];
for (const [i, r] of pick.entries()) {
  const res = await fetch(`${U}/functions/v1/summarize`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ article_id: r.id, target: "classify", dry: true }),
  });
  const j = await res.json().catch(() => ({}));
  const mineInc = r.planner_included;
  const theirsInc = j.include !== false && !!j.topic;
  const mine = mineInc ? r.topic : "제외";
  const theirs = theirsInc ? j.topic : "제외";
  const head = `${String(i + 1).padStart(3)}/${pick.length}`;
  if (mine === theirs) {
    same++;
    console.log(`${head} 같음   ${String(mine).padEnd(13)} ${r.title.slice(0, 36)}`);
  } else {
    diff.push([r, mine, theirs, j]);
    console.log(`${head} 다름   내=${String(mine).padEnd(13)} LLM=${String(theirs).padEnd(13)} ${r.title.slice(0, 30)}`);
  }
  await new Promise((x) => setTimeout(x, 15000));
}

console.log(`\n=== 대조 결과 ===\n  같음 ${same} / ${pick.length}  (${Math.round((same / pick.length) * 100)}%)`);
if (diff.length) {
  console.log(`\n  어긋난 ${diff.length}건 — **어느 쪽이 맞는지는 근거를 보고 정하세요.**\n`);
  for (const [r, mine, theirs, j] of diff) {
    console.log(`  · ${r.title.slice(0, 50)}`);
    console.log(`      내  ${mine} · ${(r.planner_evidence ?? "-").replace(/\s+/g, " ").slice(0, 80)}`);
    console.log(`      LLM ${theirs} · ${(j.evidence ?? "-").replace(/\s+/g, " ").slice(0, 80)}`);
    console.log(`      ${r.id}`);
  }
}
console.log("");
