import { log } from "../_env.mts";
import { htmlToText } from "../../src/core/0-collect/content";
import { hasGeminiKey } from "../../src/core/shared/ai";
import { attachConcepts } from "../../src/core/pipeline";
import { listArticles, markIncluded } from "../../src/core/shared/db";
import type { Learning } from "../../src/core/shared/types";

// 사용: npm run backfill-concepts — 포함된 글 중 "읽기 전에 알아두면 좋은 개념"이 없는 글만 만든다
//   --ids=29,41  특정 글만(이미 있어도 다시)   --dry  저장하지 않고 결과만 출력
// 무료 키 하루 한도(PerDay)에 걸리면 멈춘다. 같은 명령으로 이어서 돌리면 남은 글만 한다.
if (!hasGeminiKey()) {
  log("✗ GEMINI_API_KEY 가 없어요.");
  process.exit(1);
}

const ids = process.argv.find((a) => a.startsWith("--ids="))?.slice(6).split(",").map(Number);
const dry = process.argv.includes("--dry");

const all = await listArticles("included", { content: true });
const todo = all.filter((a) => a.learning && (ids ? ids.includes(a.id) : !a.learning.concepts?.length));
log(`개념 만들기 ${todo.length}건 (포함된 글 ${all.length}건 중)${dry ? " — 저장 안 함" : ""}`);

for (const a of todo) {
  const l: Learning = { ...a.learning!, concepts: undefined };
  log(`  · #${a.id} ${a.title}`);
  let daily = false;
  await attachConcepts(l, a.title, htmlToText(a.contentHtml), (m) => {
    if (/PerDay/.test(m)) daily = true;
    log(m);
  });
  if (daily) {
    log("■ 무료 키 하루 한도에 걸려 멈춰요. 한도가 풀리면(한국 오후 4~5시) 같은 명령으로 이어서 돌리세요.");
    process.exit(2);
  }
  if (dry) {
    for (const c of l.concepts ?? []) log(`      [${c.term}]\n        이게 뭐야? ${c.what}\n        이 글에서 왜 나와? ${c.why}`);
  } else if (l.concepts?.length) {
    await markIncluded(a.id, l);
  }
}
