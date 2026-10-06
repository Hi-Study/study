import { log } from "../_env.mts";
import { classifyPending } from "../../src/core/pipeline";
import { collectFeeds } from "../../src/core/0-collect/sources";
import { backfillThumbnails } from "../../src/core/0-collect/thumbnail";

// 사용: npm run collect [-- 회사당글수]
const perCompany = Number(process.argv[2] ?? 6);
const added = await collectFeeds(perCompany, log);
log(`\n새 글 ${added}건 수집`);
await backfillThumbnails(log);
await classifyPending(log);
