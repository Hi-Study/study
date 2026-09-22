/**
 * 시리즈 채우기 — 제목에서 뽑은 시리즈 이름·회차를 `articles.series_key/series_no` 에 적는다.
 *
 *   node scripts/series.mjs --dry   # 무엇이 바뀌는지만 본다
 *   node scripts/series.mjs         # 실제로 적는다
 *
 * ⚠️ 규칙의 정본은 `supabase/functions/_shared/series.ts` 다 — **수집(collect)이 그걸 쓴다.**
 *    여기서는 규칙을 옮겨 적지 않고 그 파일을 읽어 정규식을 가져온다 —
 *    두 벌이 되면 **수집한 글과 다시 채운 글이 서로 다른 시리즈**가 된다.
 *    새 글은 수집 때 자동으로 채워지므로, 이 명령은 **옆 글을 다시 채울 때**만 돌린다.
 * ⚠️ 스키마 §40 을 먼저 실행해야 한다(series_key / series_no 컬럼).
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import process from "node:process";

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
const dry = process.argv.includes("--dry");

// ── 규칙을 정본에서 그대로 가져온다 ─────────────────────────────
const src = readFileSync(`${ROOT}/supabase/functions/_shared/series.ts`, "utf8");
const NUMBER_PATTERNS = [...src.matchAll(/^\s{2}(\/.*\/[a-z]*),$/gm)]
  .map((m) => m[1])
  .map((lit) => {
    const i = lit.lastIndexOf("/");
    return new RegExp(lit.slice(1, i), lit.slice(i + 1));
  });
if (NUMBER_PATTERNS.length < 5) throw new Error("_shared/series.ts 에서 회차 패턴을 못 읽었어요");
const BLOG_SUFFIX = /\s*[|\-–—]\s*(tech\.kakao\.com|카카오페이 기술 블로그|오늘의집 블로그)\s*$/i;

function seriesOf(title) {
  const t = title.replace(BLOG_SUFFIX, "").trim();
  const paren = t.match(/[(（]([^)）]*?시리즈)\s*(\d+)[)）]/);
  if (paren) return { key: paren[1].trim(), no: Number(paren[2]) };
  for (const re of NUMBER_PATTERNS) {
    const m = t.match(re);
    if (m && m.index !== undefined && m.index > 4) {
      const key = t.slice(0, m.index).replace(/[\s:：\-–—,.]+$/, "").trim();
      if (key.length >= 6) return { key, no: Number(m[1]) };
    }
  }
  const ud = t.match(/[(（]\s*(上|下)\s*[)）]/);
  if (ud && ud.index !== undefined && ud.index > 4) {
    const key = t.slice(0, ud.index).replace(/[\s:：\-–—,.]+$/, "").trim();
    if (key.length >= 6) return { key, no: ud[1] === "上" ? 1 : 2 };
  }
  return null;
}

// ── 전체를 읽어 묶는다 ─────────────────────────────────────────
const all = [];
for (let off = 0; ; off += 500) {
  const res = await fetch(
    `${U}/rest/v1/articles?select=id,title,blog_id,series_key,series_no,planner_included&limit=500&offset=${off}`,
    { headers: H },
  );
  if (!res.ok) throw new Error(`목록 조회 실패: ${res.status} ${await res.text()}`);
  const page = await res.json();
  all.push(...page);
  if (page.length < 500) break;
}

const groups = new Map();
for (const r of all) {
  const s = seriesOf(r.title);
  if (!s) continue;
  const k = `${r.blog_id}::${s.key}`;
  const list = groups.get(k) ?? [];
  list.push({ ...r, ...s });
  groups.set(k, list);
}
/**
 * ⚠️ **한 편뿐이어도 지우지 않는다.** 수집(collect)도 1편만 있을 때 이미 적어 두는데,
 *    여기서 지워 버리면 나중에 2편이 들어와도 1편에 키가 없어 **묶이지 않는다.**
 *    "2편 이상일 때만 시리즈"는 **보여줄 때** 판단한다(SeriesCard 가 2편 미만이면 안 그린다).
 */

const members = [...groups.values()].flat();
const shown = [...groups.values()].filter((v) => v.length >= 2);
console.log(
  `시리즈 ${shown.length}개 · 글 ${shown.flat().length}건` +
    ` (한 편뿐인 ${groups.size - shown.length}개는 적어만 둔다)\n`,
);

let wrote = 0;
for (const [, list] of [...groups].filter(([, v]) => v.length >= 2).sort((a, b) => b[1].length - a[1].length)) {
  const inc = list.filter((x) => x.planner_included === true).length;
  const mark = inc > 0 && inc < list.length ? "⚠ 끊김" : "      ";
  console.log(`${mark} ${list.length}편 (채택 ${inc})  ${list[0].key.slice(0, 44)}`);
  for (const r of list) {
    if (r.series_key === r.key && r.series_no === r.no) continue;
    if (dry) { wrote++; continue; }
    const res = await fetch(`${U}/rest/v1/articles?id=eq.${r.id}`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ series_key: r.key, series_no: r.no }),
    });
    if (!res.ok) throw new Error(`${r.id}: ${res.status} ${await res.text()}`);
    wrote++;
  }
}
// 한 편뿐인 시리즈도 조용히 적어 둔다(위 주석 참고).
for (const [, list] of [...groups].filter(([, v]) => v.length < 2)) {
  for (const r of list) {
    if (r.series_key === r.key && r.series_no === r.no) continue;
    if (dry) {
      wrote++;
      continue;
    }
    const res = await fetch(`${U}/rest/v1/articles?id=eq.${r.id}`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ series_key: r.key, series_no: r.no }),
    });
    if (!res.ok) throw new Error(`${r.id}: ${res.status} ${await res.text()}`);
    wrote++;
  }
}

// 회차 표시가 아예 사라진 글만 지운다(제목이 바뀌거나 규칙을 고쳤을 때).
const ids = new Set(members.map((m) => m.id));
const stale = all.filter((r) => r.series_key && !ids.has(r.id));
if (!dry) {
  for (const r of stale) {
    await fetch(`${U}/rest/v1/articles?id=eq.${r.id}`, {
      method: "PATCH",
      headers: { ...H, Prefer: "return=minimal" },
      body: JSON.stringify({ series_key: null, series_no: null }),
    });
  }
}
console.log(`\n${dry ? "[--dry] 적을 것" : "적음"} ${wrote}건${stale.length ? ` · 지울 것 ${stale.length}건` : ""}`);
