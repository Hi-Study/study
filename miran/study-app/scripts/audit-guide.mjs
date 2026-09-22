/**
 * 가이드 품질 감사 — 규칙을 지켰는지 본다.
 *
 *   node scripts/audit-guide.mjs --dry              # 저장된 가이드만 판정 (토큰 0)
 *   node scripts/audit-guide.mjs --limit 5          # 5건 새로 생성해서 판정 (건당 7,000토큰)
 *   node scripts/audit-guide.mjs --dry --skip 탐색하는
 *
 * ⚠️ **기계가 판정할 수 있는 것만 O/X 로 센다.**
 *    처음엔 "첫 문단이 문제로 시작하는가"까지 O/X 를 냈다. 문제를 말하는 어휘 목록으로
 *    판정했는데 "막막함을 느꼈어요", "메모리 한계 때문에" 를 놓쳐 **0/5 라는 틀린 결론**을
 *    냈다. 그걸 믿고 없는 문제를 쫓았다.
 *    한국어에서 "어려웠다"를 말하는 방식은 닫힌 집합이 아니다 — 어휘를 늘려도 다음에 또 놓친다.
 *    그래서 **의미 판단이 필요한 항목은 O/X 를 내지 않고 원문을 뽑아 사람이 읽게** 한다.
 *    대신 해결 어휘(`~를 도입했`, 부품 이름 …)는 목록이 좁아서, 그걸로 **의심 표시**만 붙인다.
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
const headers = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const dry = args.includes("--dry");
const limit = Number(args[args.indexOf("--limit") + 1]) || 5;
const skip = args.includes("--skip") ? args[args.indexOf("--skip") + 1] : null;

/** 개발 문서 말투 — 치환표(PLAIN_WORDS)가 걸러야 하는 말. 문자열 매칭이라 판정이 정확하다. */
const DEV_WORDS = [
  "minuteStep", "locale", "Portal", "props", "ESC", "팝오버", "커스텀 레이블",
  "네이티브 폼", "Date 객체", "비활성 상태", "패딩", "푸터", "렌더링",
];

/**
 * **해결**을 말하는 방식 — 문제를 말하는 방식보다 목록이 훨씬 좁다.
 * 첫 문단이 이걸로 시작하면 "문제 없이 해결부터 갔다"는 **의심**이다(단정이 아니다).
 */
const SOLUTION_START = [
  /^[A-Z][A-Za-z ]{2,}(는|은|를|을|로|으로)/, // "Quantity Picker는", "SEED에"
  /(도입|적용|추가|구축|개발|제작)(했|하여|해서|하고)/,
  /(만들었|바꿨|고쳤|붙였|올렸|나눴)/,
  /(사용하면|쓰면|활용해)/,
];

const isV3 = (g) => !!g && !!g.lead && typeof g.lead.what === "string";

function machineChecks(g) {
  const lead = g.lead ?? {};
  const sections = g.sections ?? [];
  const all = [
    lead.what, lead.why, lead.how, lead.soWhat, g.plannerPoint,
    ...sections.flatMap((s) => [s.question, ...(s.paras ?? []), s.outcome]),
  ].filter(Boolean).join(" ");

  return {
    // 접속사는 **닫힌 집합**이라 이건 세도 된다.
    threeBeat: (String(lead.what ?? "").match(/그런데|그래서|그렇다고|하지만/g) ?? []).length >= 2,
    // 가정문은 문두 표현만 본다 — "검색하면 나와요" 같은 정상 문장을 오탐하지 않게 좁혔다.
    noIf: !/(이렇게 하면|이럴 경우|이럴 때|만약)/.test(`${lead.what ?? ""} ${lead.why ?? ""}`),
    devWords: DEV_WORDS.filter((w) => all.includes(w)),
    politeQ: sections.every((s) => /(요|까요|나요)\?$/.test(s.question ?? "")),
    noFormal: !/합니다|습니다/.test(all),
    withOutcome: sections.filter((s) => (s.outcome ?? "").length > 0).length,
    sections: sections.length,
    terms: (g.terms ?? []).length,
    hasPP: (g.plannerPoint ?? "").length > 0,
    // 판정이 아니라 **의심 표시**. 사람이 아래 원문을 읽고 정한다.
    suspects: sections
      .map((s, i) => ({ i: i + 1, first: s.paras?.[0] ?? "" }))
      .filter((x) => SOLUTION_START.some((re) => re.test(x.first))),
  };
}

const q = `select=id,title,reading_guide&order=published_at.desc&limit=${limit + 8}`;
let rows = (await (await fetch(`${URL_BASE}/rest/v1/articles?${q}`, { headers })).json()).filter(
  (a) => !skip || !a.title.includes(skip),
);
if (dry) rows = rows.filter((a) => isV3(a.reading_guide));
rows = rows.slice(0, limit);

console.log(
  dry
    ? `저장된 가이드 ${rows.length}건 판정 (토큰 0)\n`
    : `감사 ${rows.length}건 · 예상 토큰 ≈ ${(rows.length * 7000).toLocaleString()}\n`,
);

const tally = { threeBeat: 0, noIf: 0, noDev: 0, politeQ: 0, noFormal: 0, hasPP: 0 };
const readMe = [];
let okCount = 0;

for (const [i, a] of rows.entries()) {
  const head = `${i + 1}/${rows.length}`;
  let guide = a.reading_guide;

  if (!dry) {
    const r = await (
      await fetch(`${URL_BASE}/functions/v1/summarize`, {
        method: "POST",
        headers,
        body: JSON.stringify({ article_id: a.id, target: "guide" }),
      })
    ).json();
    if (!r.ok) {
      console.log(`${head} ✗ 생성 실패  ${String(r.reason ?? "?").slice(0, 56)} · ${a.title.slice(0, 22)}`);
      if (String(r.reason ?? "").includes("tokens per day")) break;
      await sleep(25000);
      continue;
    }
    [{ reading_guide: guide }] = await (
      await fetch(`${URL_BASE}/rest/v1/articles?select=reading_guide&id=eq.${a.id}`, { headers })
    ).json();
  }
  if (!isV3(guide)) {
    console.log(`${head} – 가이드 없음/옛 형식 · ${a.title.slice(0, 22)}`);
    continue;
  }

  okCount++;
  const m = machineChecks(guide);
  if (m.threeBeat) tally.threeBeat++;
  if (m.noIf) tally.noIf++;
  if (m.devWords.length === 0) tally.noDev++;
  if (m.politeQ) tally.politeQ++;
  if (m.noFormal) tally.noFormal++;
  if (m.hasPP) tally.hasPP++;

  console.log(
    `${head} ${a.title.slice(0, 26)}\n` +
      `      3박자 ${m.threeBeat ? "O" : "X"} · 가정문없음 ${m.noIf ? "O" : "X"} · ` +
      `개발투없음 ${m.devWords.length === 0 ? "O" : "X(" + m.devWords.join(",") + ")"} · ` +
      `질문존댓말 ${m.politeQ ? "O" : "X"} · 반말체 ${m.noFormal ? "O" : "X"} · 기획포인트 ${m.hasPP ? "O" : "X"}\n` +
      `      칸 ${m.sections} (결말 ${m.withOutcome}) · 용어 ${m.terms}` +
      (m.suspects.length ? ` · ⚠️ 해결부터 시작 의심 ${m.suspects.map((s) => s.i).join(",")}번 칸` : ""),
  );

  // 의미 판단은 사람 몫 — 첫 문단을 모아 아래에 몰아 보여준다.
  for (const s of guide.sections ?? []) {
    readMe.push(`  ${a.title.slice(0, 16)} | ${s.question}\n    → ${(s.paras?.[0] ?? "").slice(0, 110)}`);
  }
  if (!dry && i < rows.length - 1) await sleep(25000);
}

console.log(`\n=== 기계 판정 (${okCount}건) ===`);
for (const [k, label] of [
  ["threeBeat", "3박자"], ["noIf", "가정문 없음"], ["noDev", "개발투 없음"],
  ["politeQ", "질문 존댓말"], ["noFormal", "반말체 통일"], ["hasPP", "기획 포인트"],
]) {
  console.log(`  ${label.padEnd(12)} ${tally[k]}/${okCount}`);
}

console.log(`\n=== 사람이 읽을 것: 칸마다 첫 문단이 '문제'인가 ===`);
console.log(readMe.join("\n"));
