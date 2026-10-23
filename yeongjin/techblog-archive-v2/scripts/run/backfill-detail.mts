import { log } from "../_env.mts";
import { htmlToText } from "../../src/core/0-collect/content";
import { hasGeminiKey } from "../../src/core/shared/ai";
import { attachDetail } from "../../src/core/pipeline";
import { listArticles, markIncluded } from "../../src/core/shared/db";
import type { Learning } from "../../src/core/shared/types";

// 사용: npm run backfill-detail — 포함된 글 중 글 상세 요약(overview)이 없는 글만 만든다
//   기준: hyeran/techblog-article-detail-prompt.md (요약 5칸 + 읽기 전에 알아두면 좋은 개념)
//   --all  이미 있어도 전부 다시   --ids=29,41  특정 글만(이미 있어도 다시)   --dry  저장하지 않고 결과만 출력
// 무료 키 하루 한도(PerDay)에 걸리면 멈춘다. 같은 명령으로 이어서 돌리면 남은 글만 한다.
if (!hasGeminiKey()) {
  log("✗ GEMINI_API_KEY 가 없어요.");
  process.exit(1);
}

const ids = process.argv.find((a) => a.startsWith("--ids="))?.slice(6).split(",").map(Number);
const all = process.argv.includes("--all");
const dry = process.argv.includes("--dry");

const rows = await listArticles("included", { content: true });
const todo = rows.filter((a) => a.learning && (ids ? ids.includes(a.id) : all || !a.learning.overview));
log(`상세 요약 만들기 ${todo.length}건 (포함된 글 ${rows.length}건 중)${dry ? " — 저장 안 함" : ""}`);

let saved = 0;
const kept: number[] = [];
for (const a of todo) {
  const l: Learning = structuredClone(a.learning!);
  log(`  · #${a.id} ${a.title}`);
  const r = await attachDetail(l, a, htmlToText(a.contentHtml), log);
  if (r === "daily") {
    log(`■ 무료 키 하루 한도에 걸려 멈춰요. 저장 ${saved}건. 한도가 풀리면 같은 명령으로 이어서 돌리세요.`);
    process.exit(2);
  }
  if (r === "kept") {
    kept.push(a.id);
    continue;
  }
  if (dry) {
    const o = l.overview!;
    log(`      무슨 이야기야? ${o.what}\n      왜 했어? ${o.why}\n      어떻게 했어? ${o.actions}\n      어떤 결과가 있었어? ${o.results}`);
    for (const t of o.takeaways) log(`      ✓ ${t}`);
    for (const c of l.concepts ?? []) log(`      [${c.term}]\n        이게 뭐야? ${c.what}\n        이 글에서 왜 나와? ${c.why}`);
  } else {
    await markIncluded(a.id, l);
    saved++;
  }
}
log(`\n완료 — 저장 ${saved}건 · 예전 값 유지 ${kept.length}건${kept.length ? ` (${kept.join(",")})` : ""}`);
