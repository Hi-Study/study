import { log } from "../_env.mts";
import fs from "node:fs";
import path from "node:path";
import { htmlToText } from "../../src/core/0-collect/content";
import { mergeDetailV2, validateDetailV2 } from "../../src/core/1-analyze/detail-v2";
import { getArticle, markIncluded } from "../../src/core/shared/db";
import type { Learning } from "../../src/core/shared/types";
import { allowNumbersFor, arg, readJsonl, type OutputLine } from "./_detail-v2-io.mts";
import { previewHtml } from "./_detail-v2-preview.mts";

// 사용: npm run import-detail-v2 -- --dry  (먼저 꼭 미리 보기)
//   --input=data/detail-v2/output.jsonl  가져올 파일   --ids=8,22  일부만   --force  이미 v2 인 글도 다시
//   --dry  DB 를 바꾸지 않고 바뀔 내용만 보여 준다 — data/detail-v2/preview.html 에 지금/v2 비교 화면도 만든다
// learning 전체를 덮어쓰지 않는다 — overview·concepts·tools·detailPromptVersion 만 바꾸고 나머지는 그대로 둔다.
// 저장 전에 지금 learning 을 data/detail-v2/backups/ 에 남긴다(되돌릴 때 이 파일을 쓴다).
const file = arg("input") ?? "data/detail-v2/output.jsonl";
const ids = arg("ids")?.split(",").map(Number);
const dry = process.argv.includes("--dry");
const force = process.argv.includes("--force");

const { rows, errors } = readJsonl<OutputLine>(file);
if (errors.length) {
  for (const e of errors) log(`✗ ${e}`);
  process.exit(1);
}
const todo = rows.filter((r) => !ids || ids.includes(r.id));
log(`가져오기 ${todo.length}건${dry ? " — 미리 보기(저장 안 함)" : ""}`);

/** jsonb 는 객체 키 순서를 바꿔 저장한다 — 키를 정렬해 비교한다 */
const canon = (v: unknown): string =>
  JSON.stringify(v, (_, x) =>
    x && typeof x === "object" && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x,
  );

type Ready = { id: number; title: string; url: string; before: Learning; after: Learning };
const ready: Ready[] = [];
const failed: string[] = [];
const skipped: number[] = [];
for (const r of todo) {
  const a = await getArticle(r.id);
  if (!a || a.status !== "included" || !a.learning) {
    failed.push(`#${r.id} 포함된 글이 아님`);
    continue;
  }
  if (a.learning.detailPromptVersion === 2 && !force) {
    skipped.push(r.id);
    continue;
  }
  const errs = validateDetailV2(r.detail, htmlToText(a.contentHtml), allowNumbersFor(r.id));
  if (errs.length) {
    failed.push(`#${r.id} ${errs.join(" / ")}`);
    continue;
  }
  ready.push({ id: r.id, title: a.title, url: a.url, before: a.learning, after: mergeDetailV2(a.learning, r.detail) });
}

if (dry) {
  const html = path.join(process.cwd(), "data", "detail-v2", "preview.html");
  fs.writeFileSync(html, previewHtml(ready));
  log(`비교 화면 → ${html}`);
  for (const { id, before, after } of ready) {
    const o = after.overview!;
    log(`\n#${id}`);
    log(`  [지금] 무슨 이야기야? ${before.overview?.what ?? "(없음)"}`);
    log(`  [지금] 개념: ${(before.concepts ?? []).map((c) => c.term).join(", ") || "(없음)"}`);
    log(`  [v2] 무엇을: ${o.what}\n  [v2] 왜: ${o.why}\n  [v2] 어떻게: ${o.actions}\n  [v2] 그래서: ${o.results}`);
    for (const t of o.takeaways) log(`  [v2] ✓ ${t}`);
    for (const c of after.concepts ?? []) log(`  [v2] 개념 ${c.term}\n         뭐야? ${c.what}\n         왜 나와? ${c.why}`);
    for (const t of after.tools ?? []) log(`  [v2] 도구 ${t.name} — ${t.description}`);
  }
} else if (ready.length) {
  const dir = path.join(process.cwd(), "data", "detail-v2", "backups");
  fs.mkdirSync(dir, { recursive: true });
  const backup = path.join(dir, `${new Date().toISOString().replace(/[:.]/g, "-")}-before-import.jsonl`);
  fs.writeFileSync(backup, ready.map((x) => JSON.stringify({ id: x.id, learning: x.before })).join("\n") + "\n");
  log(`백업 ${ready.length}건 → ${path.relative(process.cwd(), backup)}`);

  for (const { id, after } of ready) {
    await markIncluded(id, after);
    const saved = (await getArticle(id))?.learning;
    if (canon(saved?.overview) !== canon(after.overview) || saved?.detailPromptVersion !== 2)
      failed.push(`#${id} 저장 후 다시 읽은 값이 다름`);
  }
}

log(`\n${dry ? "반영 예정" : "반영"} ${ready.length}건 · 이미 v2 라 건너뜀 ${skipped.length}건 · 실패 ${failed.length}건`);
for (const f of failed) log(`  ✗ ${f}`);
process.exit(failed.length ? 1 : 0);
