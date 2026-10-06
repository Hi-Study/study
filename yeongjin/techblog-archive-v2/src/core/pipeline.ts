/**
 * 단계 실행 순서 — 글 하나를 1단계(배제)부터 8단계(카드 문구)까지 통과시킨다.
 *   1-analyze: 배제 판정 → 상세 분석 → 읽기 가이드
 *   2-classify: 경험 사슬 → 부담 → 누구의 부담 → 글 단위 결정 → 방식·기술 → 카드 문구
 * 홈 배치(3-place)는 저장된 결과를 화면이 읽을 때 계산한다.
 */
import { htmlToText } from "./0-collect/content";
import { analyzeArticle, buildReadingGuide, gateArticle } from "./1-analyze/analyze";
import { classifyExperience, classifyFromGuide } from "./2-classify/classify";
import { EXPERIENCE_META } from "./2-classify/taxonomy";
import { hasGeminiKey } from "./shared/ai";
import { getArticle, listArticles, markExcluded, markIncluded, saveGuide } from "./shared/db";
import type { Learning, ReadingGuide } from "./shared/types";

/** 1차 게이트 → 2차 상세 분석 → "더 들어가 볼까요?" → 가이드 칸 기준 경험 분류 */
export async function classify(id: number, log: (m: string) => void) {
  const a = getArticle(id);
  if (!a) return;
  const text = htmlToText(a.contentHtml);
  const gate = await gateArticle(a.title, text);
  if (!gate.include) {
    markExcluded(id, gate.reason);
    log(`  − 제외: ${a.title} — ${gate.reason}`);
    return;
  }
  const learning = await analyzeArticle(a.title, text);
  log(`  + 포함: ${a.title}`);
  const guide = await buildReadingGuide(a.title, a.contentHtml, log);
  log(guide ? `    가이드 ${guide.sections.length}칸` : "    가이드 저장 안 함(게이트 탈락)");
  await attachClassification(learning, a.title, text, a.contentHtml, guide, log);
  markIncluded(id, learning);
  saveGuide(id, guide);
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
  const a = getArticle(id);
  if (!a?.learning) return;
  log(`  ↻ ${a.title}`);
  await attachClassification(a.learning, a.title, htmlToText(a.contentHtml), a.contentHtml, a.guide, log);
  markIncluded(id, a.learning);
}

export async function classifyPending(log: (m: string) => void) {
  if (!hasGeminiKey()) {
    log("ℹ GEMINI_API_KEY 가 없어 분석은 건너뜁니다. 수집된 글은 '분석 대기' 상태로 남아요.");
    return;
  }
  const pending = listArticles("pending");
  log(`분석 대기 ${pending.length}건 처리`);
  for (const a of pending) {
    try {
      await classify(a.id, log);
    } catch (e) {
      log(`  ✗ ${a.title}: ${(e as Error).message}`);
    }
  }
}

