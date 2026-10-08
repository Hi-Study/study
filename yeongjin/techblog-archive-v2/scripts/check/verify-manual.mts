import "../_env.mts";
import fs from "node:fs";
import { annotateHtml, collectAnnotations } from "../../src/core/1-analyze/annotate";
import { splitBlocks } from "../../src/core/0-collect/content";
import { getArticle, getArticleIdByUrl } from "../../src/core/shared/db";
import { gateGuide } from "../../src/core/1-analyze/guide-gate";
import { EXPERIENCE_PATTERNS } from "../../src/core/2-classify/taxonomy";

// 사용: npx tsx scripts/verify-manual.mts data/manual/<file>.json
const m = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const rowId = await getArticleIdByUrl(m.url);
const row = rowId ? { id: rowId } : undefined;
if (!row) {
  console.log("✗ DB 에 없는 URL");
  process.exit(1);
}
const a = (await getArticle(row.id))!;
let ok = true;
if (m.learning) {
  const l = m.learning;
  if (!EXPERIENCE_PATTERNS.includes(l.experiencePattern)) {
    ok = false;
    console.log(`✗ experiencePattern 이 고정 7개 값이 아님: ${l.experiencePattern}`);
  }
  if (l.quickView?.summary?.length !== 3) {
    ok = false;
    console.log("✗ quickView.summary 는 정확히 3줄");
  }
  const { missed } = annotateHtml(a.contentHtml, collectAnnotations(l));
  for (const x of missed) {
    ok = false;
    console.log(`✗ 원문에서 못 찾은 발췌(${x.id}): ${x.excerpt}`);
  }
}
if (m.guide) {
  const r = gateGuide(m.guide, splitBlocks(a.contentHtml));
  if (!r.ok) {
    ok = false;
    console.log(`✗ 가이드 게이트 탈락: ${r.reason}`);
  } else {
    const before = JSON.stringify(m.guide.sections.map((s: { paras: string[] }) => s.paras));
    const after = JSON.stringify(r.guide.sections.map((s) => s.paras));
    if (before !== after) console.log("⚠ 게이트가 일부 문장/문단을 지웠어요(숫자 불일치 또는 55% 중복). 확인하세요.");
    console.log(`  가이드 ${r.guide.sections.length}칸 통과`);
  }
}
console.log(ok ? "✓ 통과" : "✗ 수정 필요");
process.exit(ok ? 0 : 1);
