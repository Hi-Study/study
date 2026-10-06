import { log } from "../_env.mts";
import { COMPANIES } from "../../src/core/0-collect/companies";
import { cleanHtml } from "../../src/core/0-collect/content";
import { insertArticle } from "../../src/core/shared/db";
import { hasGeminiKey } from "../../src/core/shared/ai";
import { classify } from "../../src/core/pipeline";
import { readArticlePage } from "../../src/core/0-collect/sources";

// 사용: npm run add-url -- <URL> [회사id]
const url = process.argv[2];
if (!url) {
  log("사용법: npm run add-url -- <URL> [회사id]");
  process.exit(1);
}
const host = new URL(url).host;
const companyId =
  process.argv[3] ?? COMPANIES.find((c) => c.blogUrl && new URL(c.blogUrl).host === host)?.id ?? host;

const it = await readArticlePage(url);
const id = insertArticle({ companyId, title: it.title, url, publishedAt: it.publishedAt, contentHtml: cleanHtml(it.html, url) });
if (!id) {
  log("이미 저장된 URL 이에요.");
  process.exit(0);
}
log(`추가됨 #${id} ${it.title} (${companyId})`);
if (hasGeminiKey()) await classify(id, log);
else log("GEMINI_API_KEY 가 없어 분석 대기 상태로 남겨요.");
