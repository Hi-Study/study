/**
 * 단계 실행 순서 — 글 하나를 1단계(배제)부터 8단계(카드 문구)까지 통과시킨다.
 *   1-analyze: 배제 판정 → 상세 분석 → 읽기 가이드
 *   2-classify: 경험 사슬 → 부담 → 누구의 부담 → 글 단위 결정 → 방식·기술 → 카드 문구
 * 홈 배치(3-place)는 저장된 결과를 화면이 읽을 때 계산한다.
 */
import { htmlToText } from "./0-collect/content";
import { companyById } from "./0-collect/companies";
import { analyzeArticle, buildDetail, buildReadingGuide, gateArticle } from "./1-analyze/analyze";
import { mergeDetailV2 } from "./1-analyze/detail-v2";
import { classifyExperience, classifyFromGuide } from "./2-classify/classify";
import { EXPERIENCE_META } from "./2-classify/taxonomy";
import { hasGeminiKey, isQuota } from "./shared/ai";
import { getArticle, listArticles, markExcluded, markIncluded, missingDetail, saveGuide } from "./shared/db";
import type { ArticleRow, Learning, ReadingGuide } from "./shared/types";

/** 1차 게이트 → 2차 상세 분석 → "더 들어가 볼까요?" → 가이드 칸 기준 경험 분류 */
export async function classify(id: number, log: (m: string) => void) {
  const a = await getArticle(id);
  if (!a) return;
  const text = htmlToText(a.contentHtml);
  const gate = await gateArticle(a.title, text);
  if (!gate.include) {
    await markExcluded(id, gate.reason);
    log(`  − 제외: ${a.title} — ${gate.reason}`);
    return;
  }
  const learning = await analyzeArticle(a.title, text);
  log(`  + 포함: ${a.title}`);
  await attachDetail(learning, a, text, log);
  const guide = await buildReadingGuide(a.title, a.contentHtml, log);
  log(guide ? `    가이드 ${guide.sections.length}칸` : "    가이드 저장 안 함(게이트 탈락)");
  await attachClassification(learning, a.title, text, a.contentHtml, guide, log);
  await markIncluded(id, learning);
  await saveGuide(id, guide);
}

/**
 * 글 상세 요약(한눈에 보기) · 읽기 전에 알아두면 좋은 개념 · 사내 도구 — docs/06_글상세_프롬프트_v2.md 기준.
 * 실패하면 예전 값을 그대로 두고(화면은 가이드의 lead·points 로 대신한다) 이유를 l.detailError 에 남긴다.
 * 저장은 부르는 쪽이 한다 — 그래야 이유가 DB 에 남고, 자동 처리(retryMissingDetail)가 나중에 다시 한다.
 * 한도 초과(429)여도 글 처리는 막지 않는다 — "daily" 를 돌려주고, 멈출지는 부르는 쪽이 정한다.
 * 한도 초과는 글 탓이 아니라 기다리면 풀리므로 실패 횟수(attempts)에 넣지 않는다.
 */
export async function attachDetail(
  l: Learning,
  a: Pick<ArticleRow, "title" | "url" | "companyId">,
  text: string,
  log: (m: string) => void,
): Promise<"ok" | "kept" | "daily"> {
  const failed = (reason: string, count = true) => {
    const attempts = (l.detailError?.attempts ?? 0) + (count ? 1 : 0);
    l.detailError = { reason, at: new Date().toISOString(), attempts };
    log(`    · 상세 요약 저장 안 함(${reason}) → 예전 값 유지${count ? `, ${attempts}번째 실패` : ", 횟수는 세지 않음"}`);
  };
  try {
    const r = await buildDetail({ title: a.title, company: companyById(a.companyId).name, url: a.url, text }, log);
    if ("fail" in r) {
      failed(r.fail);
      return "kept";
    }
    const d = r.detail;
    // overview·concepts·tools·detailPromptVersion 네 칸을 한 번에 — 나머지 learning 은 그대로
    Object.assign(l, mergeDetailV2(l, d));
    delete l.detailError;
    log(
      `    상세 요약 v2 · 개념 ${d.concepts.length}개: ${d.concepts.map((c) => c.term).join(", ") || "없음"}` +
        ` · 도구 ${d.tools.map((t) => t.name).join(", ") || "없음"}`,
    );
    return "ok";
  } catch (e) {
    const msg = (e as Error).message;
    // 문구가 PerDay 가 아닌 429("You exceeded your current quota …")도 한도다 — 같은 날 다시 해 봐야 또 걸린다
    if (isQuota(e)) {
      failed(QUOTA_REASON, false);
      return "daily";
    }
    failed(`오류: ${msg.slice(0, 160)}`);
    return "kept";
  }
}

const QUOTA_REASON = "한도 초과";

/** Gemini 무료 한도는 미국 서부 시간 자정(한국 오후 4~5시)에 풀린다 — 그 기준의 날짜 */
const quotaDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(d);

/**
 * 상세 요약이 빈 포함 글을 다시 만든다 — 자동 처리가 대기 글을 다 하고 시간이 남을 때 부른다.
 * 최신 글부터, 3번 실패한 글은 건너뛴다. 결과(성공·실패 이유)는 바로 저장한다.
 * 한도가 풀린 뒤(미국 서부 자정) 한도 초과가 한 번이라도 기록됐으면 다음 초기화까지 아무것도 하지 않는다.
 */
export async function retryMissingDetail(
  log: (m: string) => void,
  hasTime: () => boolean,
): Promise<{ retried: number; filled: number; daily: boolean }> {
  let retried = 0;
  let filled = 0;
  const missing = await missingDetail(20);
  const today = quotaDay(new Date());
  const hit = missing.find((a) => {
    const e = a.learning!.detailError;
    return e?.reason === QUOTA_REASON && quotaDay(new Date(e.at)) === today;
  });
  if (hit) {
    log(`  · 상세 요약 다시: 오늘 한도 초과(#${hit.id}, ${hit.learning!.detailError!.at.slice(11, 16)} UTC) — 다음 초기화까지 기다려요`);
    return { retried, filled, daily: true };
  }
  for (const a of missing.slice(0, 5)) {
    if (!hasTime()) break;
    const l = a.learning!;
    log(`  ↻ 상세 요약 다시 #${a.id} (${l.detailError ? `${l.detailError.attempts}번 실패: ${l.detailError.reason}` : "이유 기록 없음"})`);
    const r = await attachDetail(l, a, htmlToText(a.contentHtml), log);
    await markIncluded(a.id, l);
    retried++;
    if (r === "ok") filled++;
    if (r === "daily") return { retried, filled, daily: true };
  }
  return { retried, filled, daily: false };
}

/** 가이드가 있으면 칸 기준(v3), 없으면 원문 기준(v2)으로 경험을 분류한다 */
async function attachClassification(
  l: Learning,
  title: string,
  text: string,
  html: string,
  guide: ReadingGuide | null,
  log: (m: string) => void,
) {
  const r = guide?.sections.length
    ? await classifyFromGuide(title, guide, html, text, log)
    : { ...(await classifyExperience(title, text, html, log)), problemCard: null };
  const { classification, cardHeadline } = r;
  l.classification = classification;
  l.cardHeadline = cardHeadline ?? undefined;
  l.problemCard = r.problemCard ?? undefined;
  // v01 호환 필드
  l.experiencePattern = classification.experience ? EXPERIENCE_META[classification.experience].label : "";
  const c = classification;
  log(
    `    경험: ${c.experience ?? `해당 없음(${c.articleType})`} · ${c.fit} · ${c.beneficiary}` +
      (c.primarySection ? ` · 칸${c.primarySection}` : "") +
      (cardHeadline ? ` · "${cardHeadline}"` : " · 카드 문장 탈락"),
  );
  if (r.problemCard) log(`    문제 카드: ${r.problemCard.title} / ${r.problemCard.summary}`);
}

/** 이미 포함된 글의 경험 분류만 다시 한다 (분석·가이드는 그대로) */
export async function reclassifyExperience(id: number, log: (m: string) => void) {
  const a = await getArticle(id);
  if (!a?.learning) return;
  log(`  ↻ ${a.title}`);
  await attachClassification(a.learning, a.title, htmlToText(a.contentHtml), a.contentHtml, a.guide, log);
  await markIncluded(id, a.learning);
}

/**
 * 포함된 글 다시 만들기 — 필요한 단계만 다시 돌린다.
 * reanalyze: 상세 분석(핵심 카피·결론·BEFORE/AFTER)을 원문 전체로 다시 · reguide: "더 들어가 볼까요?"를 원문 끝까지 읽고 다시.
 * 분류는 항상 다시 한다. 새 가이드가 게이트에서 떨어지면 예전 가이드를 지키고 그것으로 분류한다.
 */
export async function rebuildIncluded(
  id: number,
  opts: { reanalyze: boolean; reguide: boolean },
  log: (m: string) => void,
) {
  const a = await getArticle(id);
  if (!a) return;
  const text = htmlToText(a.contentHtml);
  const learning = opts.reanalyze || !a.learning ? await analyzeArticle(a.title, text) : a.learning;
  if (learning.detailPromptVersion !== 2) await attachDetail(learning, a, text, log);
  let guide = a.guide;
  if (opts.reguide || !guide) {
    const fresh = await buildReadingGuide(a.title, a.contentHtml, log);
    if (fresh) guide = fresh;
    log(fresh ? `    가이드 새로 ${fresh.sections.length}칸` : `    새 가이드 탈락 → ${guide ? "예전 가이드 유지" : "가이드 없음"}`);
  }
  await attachClassification(learning, a.title, text, a.contentHtml, guide, log);
  await markIncluded(id, learning);
  await saveGuide(id, guide);
}

export async function classifyPending(log: (m: string) => void) {
  if (!hasGeminiKey()) {
    log("ℹ GEMINI_API_KEY 가 없어 분석은 건너뜁니다. 수집된 글은 '분석 대기' 상태로 남아요.");
    return;
  }
  const pending = await listArticles("pending");
  log(`분석 대기 ${pending.length}건 처리`);
  for (const a of pending) {
    try {
      await classify(a.id, log);
    } catch (e) {
      log(`  ✗ ${a.title}: ${(e as Error).message}`);
    }
  }
}

