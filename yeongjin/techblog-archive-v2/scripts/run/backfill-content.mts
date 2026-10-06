import { log } from "../_env.mts";
import { htmlToText } from "../../src/core/0-collect/content";
import { listArticles, updateContent } from "../../src/core/shared/db";
import { ensureFullContent } from "../../src/core/0-collect/sources";

// 원문이 비정상적으로 짧게 저장된 글의 본문 재수집
const all = [...listArticles("pending"), ...listArticles("included"), ...listArticles("excluded")];
let fixed = 0;
for (const a of all) {
  const before = htmlToText(a.contentHtml).length;
  if (before >= 500) continue;
  const html = await ensureFullContent(a.url, a.contentHtml);
  const after = htmlToText(html).length;
  if (after > before) {
    updateContent(a.id, html);
    fixed++;
    log(`✓ #${a.id} ${before}자 → ${after}자  ${a.title}`);
  }
}
log(`${fixed}건 보강`);
