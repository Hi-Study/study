import { log } from "../_env.mts";
import { listArticles } from "../../src/core/shared/db";

// 사용: npm run verify-detail-v2 — 포함된 글의 상세 v2 반영 현황(감사). DB 는 읽기만 한다.
const rows = await listArticles("included");
const v2 = rows.filter((a) => a.learning?.detailPromptVersion === 2);
const notV2 = rows.filter((a) => a.learning?.detailPromptVersion !== 2).map((a) => a.id);
const lostMeta = v2.filter((a) => !a.learning!.classification || !a.learning!.tags?.length || !a.learning!.cardHeadline).map((a) => a.id);
const noOverview = v2.filter((a) => !a.learning!.overview?.what).map((a) => a.id);
const withTools = v2.filter((a) => a.learning!.tools?.length);

log(`포함 ${rows.length}건 · v2 ${v2.length}건 · v2 아님 ${notV2.length}건`);
if (notV2.length) log(`  v2 아닌 ID: ${notV2.sort((a, b) => a - b).join(",")}`);
// 실패 이유 — 자동 처리가 남긴 learning.detailError. 3번 실패한 글은 자동으로 다시 하지 않는다
for (const a of rows.filter((x) => x.learning?.detailPromptVersion !== 2).sort((x, y) => x.id - y.id)) {
  const e = a.learning?.detailError;
  log(`    #${a.id} ${e ? `${e.attempts}번 실패${e.attempts >= 3 ? "(자동 재시도 끝)" : ""} · ${e.at.slice(0, 16)} · ${e.reason}` : "이유 기록 없음(기록 기능 이전 실패)"}`);
}
log(`  요약 없는 v2: ${noOverview.join(",") || "없음"}`);
log(`  분류·태그·카드 문구가 빠진 v2: ${lostMeta.join(",") || "없음"}`);
log(`  도구가 있는 글 ${withTools.length}건: ${withTools.map((a) => `#${a.id} ${a.learning!.tools!.map((t) => t.name).join("/")}`).join(", ") || "없음"}`);
const n = (k: "concepts" | "tools") => v2.reduce((s, a) => s + (a.learning![k]?.length ?? 0), 0);
log(`  평균 개념 ${(n("concepts") / (v2.length || 1)).toFixed(1)}개`);
