/**
 * 자동 실행 — Supabase 예약 작업(pg_cron)이 배포된 서비스의 /api/cron/* 를 부르면 여기서 돈다.
 *   collect: 하루 한 번. 18개 블로그에서 새 글을 모아 '대기'로 넣고 썸네일을 찾는다(AI 호출 없음).
 *   process: 자주(예: 15분마다). 대기 글을 시간 예산 안에서 몇 건씩 판정·분석·분류한다.
 *            대기 글이 없고 시간이 남으면 상세 요약이 빈 포함 글을 다시 만든다(실패 이유는 learning.detailError).
 * 배포 서버는 한 번 실행에 쓸 수 있는 시간이 정해져 있어서, 분석은 짧게 여러 번 나눠 돈다.
 * 같은 작업이 겹쳐 돌지 않게 Supabase 잠금(try_lock)을 건다. 설정: docs/05_배포와_자동수집.md
 */
import { collectFeeds } from "./0-collect/sources";
import { backfillThumbnails } from "./0-collect/thumbnail";
import { classify, retryMissingDetail } from "./pipeline";
import { bumpAttempts, pendingForAuto, releaseLock, tryLock } from "./shared/db";
import { hasGeminiKey } from "./shared/ai";

export type AutoResult = { ok: boolean; skipped?: string; log: string[]; [k: string]: unknown };

async function withLock(name: string, seconds: number, run: (log: (m: string) => void) => Promise<Record<string, unknown>>): Promise<AutoResult> {
  const lines: string[] = [];
  const log = (m: string) => {
    lines.push(m);
    console.log(`[auto:${name}] ${m}`);
  };
  if (!(await tryLock(name, seconds))) return { ok: true, skipped: "이전 실행이 아직 돌고 있어요", log: lines };
  try {
    return { ok: true, ...(await run(log)), log: lines };
  } catch (e) {
    log(`✗ ${(e as Error).message}`);
    return { ok: false, log: lines };
  } finally {
    await releaseLock(name);
  }
}

/** 새 글 모으기 — 회사당 최신 n건을 보고 처음 보는 글만 넣는다 */
export function autoCollect(perCompany = 5) {
  return withLock("collect", 280, async (log) => {
    const added = await collectFeeds(perCompany, log);
    await backfillThumbnails(log);
    log(`새 글 ${added}건`);
    return { added };
  });
}

/** 대기 글 처리 — budgetMs 안에서 최신 글부터. 하루 한도(PerDay)에 걸리면 멈추고 다음 실행으로 넘긴다 */
export function autoProcess(budgetMs = 200_000) {
  return withLock("process", 290, async (log) => {
    if (!hasGeminiKey()) return { processed: 0, skipped: "GEMINI_API_KEY 없음" };
    const start = Date.now();
    // 글 1건 판정·분석·상세 요약·분류에 보통 50~80초 — 남은 시간이 그보다 적으면 다음 실행으로 넘긴다
    const PER_ARTICLE_MS = 80_000;
    let processed = 0;
    let dailyHit = false;
    for (const p of await pendingForAuto(10)) {
      if (Date.now() - start + PER_ARTICLE_MS > budgetMs) break;
      await bumpAttempts(p.id, p.attempts);
      try {
        await classify(p.id, log);
        processed++;
      } catch (e) {
        const msg = (e as Error).message;
        log(`✗ #${p.id} ${msg.slice(0, 200)}`);
        if (/PerDay/.test(msg)) {
          log("■ Gemini 하루 한도 — 다음 실행으로 넘겨요");
          dailyHit = true;
          break;
        }
      }
    }
    const left = (await pendingForAuto(50)).length;
    log(`처리 ${processed}건 · 남은 대기 ${left}건`);

    // 남는 시간에 상세 요약이 빈 글을 다시 — 상세 요약 1건은 최대 2번 호출(1분씩)이라 2분 15초가 남아 있을 때만
    const DETAIL_MS = 135_000;
    let detail = { retried: 0, filled: 0, daily: false };
    if (!left && !dailyHit) {
      detail = await retryMissingDetail(log, () => Date.now() - start + DETAIL_MS <= budgetMs);
      if (detail.retried) log(`상세 요약 다시 ${detail.retried}건 · 채움 ${detail.filled}건${detail.daily ? " · 하루 한도" : ""}`);
    }
    return { processed, left, detailRetried: detail.retried, detailFilled: detail.filled };
  });
}
