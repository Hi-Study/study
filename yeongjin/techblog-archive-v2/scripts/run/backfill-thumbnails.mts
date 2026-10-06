import { log } from "../_env.mts";
import { backfillThumbnails } from "../../src/core/0-collect/thumbnail";

// 사용: npm run backfill-thumbnails — 썸네일을 아직 확인하지 않은 글의 대표 이미지를 찾는다
await backfillThumbnails(log);
