import fs from "node:fs";
import { DETAIL_V2_SYSTEM } from "../../src/core/1-analyze/detail-v2";

// 사용: npm run check-detail-prompt — 코드의 상세 v2 프롬프트가 hyeran/techblog-article-detail-prompt-v2.md 와 같은지 확인한다.
// 배포 서버는 문서를 읽을 수 없어 코드에 옮겨 두었다 — 문서를 고치면 코드도 고치고 이 검사로 확인한다. 다르면 종료 코드 1.
const doc = fs.readFileSync("../../hyeran/techblog-article-detail-prompt-v2.md", "utf8");
const fromDoc = doc.split(/## System prompt/)[1]?.match(/```text\r?\n([\s\S]*?)\r?\n```/)?.[1];
if (!fromDoc) {
  console.log("✗ 문서에서 System prompt 를 찾지 못했어요.");
  process.exit(1);
}
const norm = (s: string) => s.replace(/\r\n/g, "\n").trim();
const a = norm(fromDoc).split("\n");
const b = norm(DETAIL_V2_SYSTEM).split("\n");
const i = a.findIndex((line, k) => line !== b[k]);
if (i === -1 && a.length === b.length) {
  console.log("✓ 코드의 프롬프트가 문서와 같아요.");
} else {
  const n = i === -1 ? Math.min(a.length, b.length) : i;
  console.log(`✗ ${n + 1}번째 줄부터 달라요.\n  문서: ${a[n] ?? "(끝)"}\n  코드: ${b[n] ?? "(끝)"}`);
  process.exit(1);
}
