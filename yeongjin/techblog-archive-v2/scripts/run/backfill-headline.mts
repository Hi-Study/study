import fs from "node:fs";
import { log } from "../_env.mts";
import { htmlToText } from "../../src/core/0-collect/content";
import { HEADLINE_VERSION, headlineProblem, settleHeadline } from "../../src/core/1-analyze/headline";
import { hasGeminiKey, isQuota } from "../../src/core/shared/ai";
import { listArticles, markIncluded } from "../../src/core/shared/db";
import type { Learning } from "../../src/core/shared/types";

// 사용: npm run backfill-headline — 포함된 글의 제목 문장(목록·상세 공통)을 2026-11-16 통일 기준으로 다시 만든다
//   기준: src/core/1-analyze/headline.ts · docs/01_분류기준.md 2단계 "제목 문장"
//   이미 새 기준(headlineVersion 2)으로 만든 글은 건너뛴다 — 한도에 걸려 멈췄으면 같은 명령으로 이어서 돌린다
//   --ids=29,41  특정 글만(이미 있어도 다시)   --limit=5  앞에서 N건만   --dry  저장하지 않고 예전 → 새 문장만 출력
//   --from=headlines.json  Gemini 를 쓰지 않고 파일의 문장({"글 id": "문장"})을 넣는다(Claude Code 가 쓴 문장 등).
//                          같은 코드 검사를 거치고, 걸린 문장은 저장하지 않고 이유만 보여 준다 — 고쳐서 다시 돌린다
// Gemini 로 만들 때는 글 하나에 1번(규칙에 걸리면 2번). 두 번 다 걸리면 제목 문장을 비워 원제목이 보이게 한다.
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const from = arg("from");
const given: Record<string, string> | null = from ? JSON.parse(fs.readFileSync(from, "utf8")) : null;
const ids = arg("ids")?.split(",").map(Number) ?? (given ? Object.keys(given).map(Number) : undefined);
const limit = Number(arg("limit") ?? Infinity);
const dry = process.argv.includes("--dry");

if (!given && !hasGeminiKey()) {
  log("✗ GEMINI_API_KEY 가 없어요.");
  process.exit(1);
}

const rows = await listArticles("included", { content: true });
const todo = rows
  .filter((a) => a.learning && (ids ? ids.includes(a.id) : a.learning.headlineVersion !== HEADLINE_VERSION))
  .slice(0, limit);
log(`제목 문장 다시 만들기 ${todo.length}건 (포함된 글 ${rows.length}건 중)${given ? ` — ${from} 에서` : ""}${dry ? " — 저장 안 함" : ""}`);
if (ids) {
  const missing = ids.filter((id) => !todo.some((a) => a.id === id));
  if (missing.length) log(`! 포함된 글이 아니라 뺀 ID: ${missing.join(",")}`);
}

let saved = 0;
const dropped: number[] = [];
const rejected: string[] = [];
for (const a of todo) {
  const l: Learning = structuredClone(a.learning!);
  const text = htmlToText(a.contentHtml);
  let h: string | null;
  if (given) {
    h = (given[String(a.id)] ?? "").trim();
    const p = headlineProblem(h, text);
    if (p) {
      rejected.push(`#${a.id} ${p}: ${h}`);
      continue;
    }
  } else {
    try {
      h = await settleHeadline(a.title, text, undefined, log);
    } catch (e) {
      if (isQuota(e)) {
        log(`■ 무료 키 한도에 걸려 멈춰요. 저장 ${saved}건. 한도가 풀리면 같은 명령으로 이어서 돌리세요.`);
        process.exit(2);
      }
      log(`  ✗ #${a.id} ${(e as Error).message.slice(0, 160)}`);
      continue;
    }
  }
  log(`  · #${a.id} ${a.title}\n      예전: ${l.cardHeadline ?? "(없음 — 원제목)"}\n      새로: ${h ?? "(규칙 위반 — 원제목)"}`);
  if (!h) dropped.push(a.id);
  if (dry) continue;
  if (h) l.cardHeadline = h;
  else delete l.cardHeadline;
  l.headlineVersion = HEADLINE_VERSION;
  await markIncluded(a.id, l);
  saved++;
}
for (const r of rejected) log(`  ✗ 검사 탈락 ${r}`);
log(
  `\n완료 — 저장 ${saved}건 · 원제목으로 ${dropped.length}건${dropped.length ? ` (${dropped.join(",")})` : ""}` +
    (given ? ` · 검사 탈락 ${rejected.length}건` : ""),
);
