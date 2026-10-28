import { log } from "../_env.mts";
import fs from "node:fs";
import path from "node:path";
import { htmlToText } from "../../src/core/0-collect/content";
import { companyById } from "../../src/core/0-collect/companies";
import { listArticles } from "../../src/core/shared/db";

// 사용: npm run export-detail-v2 — 글 상세 v2 백필용 입력(JSONL)을 만든다. DB 는 읽기만 한다.
//   기본: 포함된 글 중 v2 가 아닌 글   --all  v2 여도 전부   --ids=8,22,42  특정 글만
//   출력: data/detail-v2/input.jsonl (id·제목·회사·URL·원문 텍스트), input-errors.jsonl (본문이 없거나 너무 짧은 글)
//   이 파일을 Claude Code 가 hyeran/techblog-article-detail-prompt-v2.md 로 분석해 output.jsonl 을 만든다.
const MIN_TEXT = 300;

const ids = process.argv.find((a) => a.startsWith("--ids="))?.slice(6).split(",").map(Number);
const all = process.argv.includes("--all");

const rows = await listArticles("included", { content: true });
const todo = rows.filter((a) => (ids ? ids.includes(a.id) : all || a.learning?.detailPromptVersion !== 2));

const dir = path.join(process.cwd(), "data", "detail-v2");
fs.mkdirSync(dir, { recursive: true });
const ok: string[] = [];
const bad: string[] = [];
for (const a of todo.sort((x, y) => x.id - y.id)) {
  const text = htmlToText(a.contentHtml).trim();
  if (text.length < MIN_TEXT) {
    bad.push(JSON.stringify({ id: a.id, title: a.title, reason: text ? `본문이 너무 짧음(${text.length}자)` : "본문 없음" }));
    continue;
  }
  ok.push(JSON.stringify({ id: a.id, title: a.title, company: companyById(a.companyId).name, url: a.url, text }));
}
fs.writeFileSync(path.join(dir, "input.jsonl"), ok.join("\n") + (ok.length ? "\n" : ""));
fs.writeFileSync(path.join(dir, "input-errors.jsonl"), bad.join("\n") + (bad.length ? "\n" : ""));
if (ids) {
  const missing = ids.filter((id) => !todo.some((a) => a.id === id));
  if (missing.length) log(`! 포함된 글이 아니라 뺀 ID: ${missing.join(",")}`);
}
log(`입력 ${ok.length}건 · 본문 문제 ${bad.length}건 (포함된 글 ${rows.length}건 중) → data/detail-v2/`);
