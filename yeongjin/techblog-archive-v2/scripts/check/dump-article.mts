import "../_env.mts";
import { splitBlocks } from "../../src/core/0-collect/content";
import { getArticle } from "../../src/core/shared/db";

// 사용: npx tsx scripts/dump-article.mts <id>  — 번호 매긴 원문 블록(전문)을 출력
const a = await getArticle(Number(process.argv[2]));
if (!a) {
  console.log("없는 글");
  process.exit(1);
}
console.log(`# ${a.title}\nURL: ${a.url}\n`);
for (const b of splitBlocks(a.contentHtml)) console.log(`[${b.n}]${b.heading ? " (소제목)" : ""} ${b.text}\n`);
