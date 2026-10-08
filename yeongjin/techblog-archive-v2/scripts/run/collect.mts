import { log } from "../_env.mts";
import { classifyPending } from "../../src/core/pipeline";
import { collectFeeds } from "../../src/core/0-collect/sources";
import { backfillThumbnails } from "../../src/core/0-collect/thumbnail";

// 사용: npm run collect [-- 회사당글수] [--only=회사id,회사id]
//   예) npm run collect -- 5 --only=gangnamunni   — 강남언니만 최신 5건
const perCompany = Number(process.argv.slice(2).find((a) => /^\d+$/.test(a)) ?? 6);
const only = process.argv.find((a) => a.startsWith("--only="))?.slice(7).split(",");
const added = await collectFeeds(perCompany, log, only);
log(`\n새 글 ${added}건 수집`);
await backfillThumbnails(log);
await classifyPending(log);
