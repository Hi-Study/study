import { log } from "../_env.mts";
import { listArticles } from "../../src/core/shared/db";
import { rebuildIncluded } from "../../src/core/pipeline";

// 사용: npm run reinclude-non-event            → 미리보기만(DB 변경 없음)
//      npm run reinclude-non-event -- --apply  → 실제로 반영
// 요청: 제외된 글 중 "행사 글"만 제외로 남기고, 나머지는 모두 포함으로 되돌린다.
// exclusionReason 은 1차 게이트(analyze.ts GATE_SYS)가 쓴 한국어 한 문장이라, 그 문장에 행사 관련
// 어휘가 있는지로 판정한다. 애매하면(행사 어휘가 없으면) "포함"쪽으로 둔다 — 사용자가 "나머지는 모두 포함"이라 했다.
const EVENT_WORDS = [
  "행사", "컨퍼런스", "콘퍼런스", "밋업", "미트업", "세미나", "서밋", "Summit",
  "참관기", "세션 소개", "세션소개", "신청 안내", "신청안내", "채용 공고", "채용공고", "모집",
];

function isEventReason(reason: string): boolean {
  return EVENT_WORDS.some((w) => reason.includes(w));
}

const apply = process.argv.includes("--apply");

const excluded = await listArticles("excluded", { content: true });
log(`제외된 글 ${excluded.length}건 검토`);

const keepExcluded = excluded.filter((a) => isEventReason(a.exclusionReason ?? ""));
const reinclude = excluded.filter((a) => !isEventReason(a.exclusionReason ?? ""));

log(`\n■ 행사 글로 보고 제외 유지 (${keepExcluded.length}건)`);
for (const a of keepExcluded) log(`  #${a.id} ${a.title} — ${a.exclusionReason}`);

log(`\n■ 포함으로 되돌릴 글 (${reinclude.length}건)`);
for (const a of reinclude) log(`  #${a.id} ${a.title} — ${a.exclusionReason}`);

if (!apply) {
  log(`\n미리보기만 했어요. 반영하려면: npm run reinclude-non-event -- --apply`);
  process.exit(0);
}

log(`\n반영 시작 — 분석 → 가이드 → 분류를 새로 만든다(각 글마다 Gemini 호출 여러 번)`);
let ok = 0;
let failed = 0;
for (const a of reinclude) {
  try {
    log(`\n#${a.id} ${a.title}`);
    await rebuildIncluded(a.id, { reanalyze: true, reguide: true }, log);
    ok++;
  } catch (e) {
    log(`  ✗ 실패: ${(e as Error).message.slice(0, 200)}`);
    failed++;
  }
}
log(`\n완료 — 포함 처리 ${ok}건 성공, ${failed}건 실패 (행사 글 ${keepExcluded.length}건은 그대로 제외)`);
