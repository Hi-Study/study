import { log } from "../_env.mts";
import { gateArticle } from "../../src/core/1-analyze/analyze";
import { hasGeminiKey, MODEL } from "../../src/core/shared/ai";

if (!hasGeminiKey()) {
  log("✗ GEMINI_API_KEY 가 없어요. .env.local 에 GEMINI_API_KEY=... 를 넣어 주세요.");
  process.exit(1);
}
log(`모델: ${MODEL}`);
try {
  const r = await gateArticle(
    "검색 대기 시간을 줄인 이야기",
    "사용자가 검색 결과를 보기까지 평균 3초를 기다려야 했어요. 이 문제를 풀기 위해 결과를 미리 준비해 두는 방식을 도입했고, 이탈률이 줄었어요.",
  );
  log(`✓ 키·스키마 정상 — include=${r.include}, reason=${r.reason}`);
} catch (e) {
  log(`✗ 호출 실패: ${(e as Error).message}`);
  process.exit(1);
}
