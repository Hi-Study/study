import { log } from "../_env.mts";
import fs from "node:fs";
import path from "node:path";
import { splitBlocks } from "../../src/core/0-collect/content";
import { getArticle, getArticleIdByUrl, markExcluded, markIncluded, saveGuide } from "../../src/core/shared/db";
import { gateGuide } from "../../src/core/1-analyze/guide-gate";
import type { Learning, ReadingGuide } from "../../src/core/shared/types";

/**
 * 사람이 직접 채운 분석 결과(data/manual/*.json)를 DB 에 넣는다.
 * 키 없이도 쌓인 글을 백필하는 경로. 가이드는 서버와 같은 코드 게이트를 통과해야 저장된다.
 *
 * 파일 형식: { url, exclude?: "이유", learning?: Learning, guide?: ReadingGuide }
 */
type Manual = { url: string; exclude?: string; learning?: Learning; guide?: ReadingGuide };

const dir = path.join(process.cwd(), "data", "manual");
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".json")) : [];
for (const f of files) {
  const m = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")) as Manual;
  const rowId = await getArticleIdByUrl(m.url);
  const row = rowId ? { id: rowId } : undefined;
  if (!row) {
    log(`✗ ${f}: DB 에 없는 URL — 먼저 collect/add-url 하세요`);
    continue;
  }
  if (m.exclude) {
    await markExcluded(row.id, m.exclude);
    log(`− ${f}: 제외`);
    continue;
  }
  if (m.learning) await markIncluded(row.id, m.learning);
  if (m.guide) {
    const a = (await getArticle(row.id))!;
    const r = gateGuide(m.guide, splitBlocks(a.contentHtml));
    await saveGuide(row.id, r.ok ? r.guide : null);
    log(r.ok ? `+ ${f}: 포함 · 가이드 ${r.guide.sections.length}칸` : `+ ${f}: 포함 · 가이드 게이트 탈락(${r.reason})`);
  } else log(`+ ${f}: 포함`);
}
