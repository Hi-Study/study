import { log } from "../_env.mts";
import { listArticles } from "../../src/core/shared/db";
import { hasGeminiKey } from "../../src/core/shared/ai";
import { CLASSIFY_VERSION } from "../../src/core/2-classify/classify";
import { classify, reclassifyExperience } from "../../src/core/pipeline";

// 사용:
//   npm run reclassify                 — 포함된 글의 경험 분류만 다시 (분석·가이드 유지, 글당 1~2회 호출)
//   npm run reclassify -- --full       — 전체 글을 게이트부터 다시 (글당 4~5회 호출)
//   npm run reclassify -- --missing    — 새 분류가 아직 없는 글만
//   npm run reclassify -- --stale      — 최신 분류 기준(CLASSIFY_VERSION)보다 오래된 글만
// 무료 키 하루 한도(PerDay)에 걸리면 그 자리에서 멈춘다 — 다음 날 --stale 로 이어서 돌리면 된다
if (!hasGeminiKey()) {
  log("✗ GEMINI_API_KEY 가 없어요.");
  process.exit(1);
}
const full = process.argv.includes("--full");
const missing = process.argv.includes("--missing");

if (full) {
  for (const a of [...(await listArticles("included")), ...(await listArticles("excluded")), ...(await listArticles("pending"))]) {
    try {
      await classify(a.id, log);
    } catch (e) {
      log(`✗ #${a.id} ${(e as Error).message}`);
    }
  }
} else {
  const ids = process.argv.find((x) => x.startsWith("--ids="))?.slice(6).split(",").map(Number);
  const stale = process.argv.includes("--stale");
  const rows = (await listArticles("included")).filter(
    (a) =>
      (!missing || !a.learning?.classification) &&
      (!stale || (a.learning?.classification?.version ?? 0) < CLASSIFY_VERSION) &&
      (!ids || ids.includes(a.id)),
  );
  log(`경험 분류 ${rows.length}건`);
  let done = 0;
  for (const a of rows) {
    try {
      await reclassifyExperience(a.id, log);
      done++;
    } catch (e) {
      const msg = (e as Error).message;
      if (/PerDay/.test(msg)) {
        log(`■ 무료 키 하루 한도에 걸려 멈춰요. ${done}/${rows.length}건 완료 — 한도가 풀리면(미국 태평양 자정, 한국 오후 4~5시) 'npm run reclassify -- --stale' 로 이어서 돌리세요.`);
        break;
      }
      log(`✗ #${a.id} ${msg.slice(0, 200)}`);
    }
  }
}
