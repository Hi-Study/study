/** 3~8단계 — 경험 사슬 → 부담 → 누구의 부담 → 글 단위 결정(코드 규칙) → 방식·기술 → 카드 문구. 기준 문서: docs/01_분류기준.md */
import { Type, type Schema } from "@google/genai";
import { excerptExists } from "../1-analyze/annotate";
import { json, obj, str } from "../shared/ai";
import {
  ARTICLE_TYPES,
  BENEFICIARIES,
  BURDEN_TO_EXPERIENCE,
  BURDENS,
  EXPERIENCE_META,
  EXPERIENCES,
  PRODUCT_PATTERN_LABEL,
  PRODUCT_PATTERNS,
  TECH_CATEGORIES,
  TECH_LABEL,
  type Burden,
  type ExperienceKey,
} from "./taxonomy";
import { splitBlocks, type Block } from "../0-collect/content";
import type { Classification, ReadingGuide, SectionMapping } from "../shared/types";

/**
 * v1: 첫 분류
 * v2: 변경 전 행동 먼저, execution_burden 은 마지막 선택지, 사내·사용자 동일 취급
 * v3: "더 들어가 볼까요?" 칸(problem·paras·outcome)을 근거로 칸별 매핑 → 코드가 대표·보조 경험과 적합도를 정한다
 * v4: 칸을 보기 전에 글 단위로 "제품이나 업무 도구가 실제로 바뀌었나"를 먼저 묻는다.
 *     v3 프롬프트에서 v2 의 "억지로 고르지 마라" 규칙이 빠져 문화·마케팅·행사 글이 경험으로 묶였다(회귀) — 그 규칙을 되살린다.
 *     가이드도 원문 끝까지 읽고 다시 만든다(입력 제한 제거).
 */
export const CLASSIFY_VERSION = 4;

/* ───────────── 프롬프트 ───────────── */

/**
 * 부담 정의. 서비스 사용자와 사내 사람(운영자·개발자)을 똑같이 본다 — 부담의 모양이 같으면 같은 경험이다.
 * execution_burden 은 다른 칸이 맞지 않을 때만 쓰는 마지막 선택지다(v02 점검: 79건 중 33건이 여기로 쏠렸다).
 */
const BURDEN_DEF: Record<Burden, string> = {
  time_burden:
    "결과·처리·로딩·승인·배포를 **기다림**. 예: 화면 로딩, 입점 승인 대기, 빌드·배포 대기, 리포트가 나올 때까지 대기",
  search_burden:
    "원하는 것을 **찾아 헤맴**. 예: 상품·콘텐츠 탐색, 대시보드에서 데이터 찾기, 코드·문서에서 규칙이나 원인 찾기",
  decision_burden:
    "여러 선택지를 **비교하며 고민·판단**함. 예: 상품 비교, 어떤 기술·방식을 쓸지 판단, 실험 결과 해석",
  input_burden:
    "같은 정보를 **직접 입력·작성**함. 예: 폼 작성, 태그 달기, 반복 설정값 입력, 테스트 코드·문서 직접 작성",
  context_burden:
    "같은 상황·맥락을 **다시 설명**함. 예: 상담에서 상황 재설명, AI 에이전트에게 매번 도메인 지식을 다시 알려줌, 팀 간 같은 개념을 매번 맞춤",
  execution_burden:
    "여러 단계의 일을 **손으로 직접 처리**함. 사람이 하던 **작업 절차 자체**를 시스템이 대신 수행하게 된 경우만. 예: 상담원이 계정을 직접 옮겨줌 → 자동 이전, 사람이 하던 장애 복구 절차를 에이전트가 수행",
  monitoring_burden:
    "잘 됐는지·잘못될까 봐 **계속 확인하고 걱정**함. 예: 배송·주문 상태 확인, 장애 알림을 들여다보며 원인 확인, 데이터가 맞는지 검증, 배포 후 깨졌는지 확인",
};
const burdenGuide = BURDENS.map((b) => `   - ${b} → "${EXPERIENCE_META[BURDEN_TO_EXPERIENCE[b]].label}": ${BURDEN_DEF[b]}`).join("\n");
const ppGuide = PRODUCT_PATTERNS.map((p) => `   - ${p}: ${PRODUCT_PATTERN_LABEL[p]}`).join("\n");
const techGuide = TECH_CATEGORIES.map((t) => `${t}(${TECH_LABEL[t]})`).join(", ");

const CLASSIFY_SYS = `너는 테크 블로그 글을 "사람이 덜게 된 부담"으로 분류하는 편집자다. 아래 순서대로 단계를 밟는다. 반드시 JSON 하나만 출력한다.

1) facts — 원문에서 확인 가능한 사실만. 문제 / 변경(무엇을 바꿨나) / 기술 / 결과. 각 한 문장. 원문에 결과가 없으면 "원문에 없음".

2) beneficiary — 이 변화로 부담을 덜게 된 사람. **글에 최종 사용자가 겪는 변화가 나오면 END_USER 를 먼저 고른다.**
   - END_USER: 서비스를 쓰는 고객·사용자 + 입점 사장님·판매자·파트너·광고주 등 회사 바깥 사람
   - OPERATOR: 사내 운영자·상담원·현업 담당자·매장 직원·마케터·디자이너 등 개발자가 아닌 회사 안 사람
   - DEVELOPER: 개발자·QA·SRE 등 만드는 사람
   ※ 사내 사람의 부담도 사용자 부담과 똑같이 다룬다. 사람만 다를 뿐 부담의 모양이 같으면 같은 경험이다.

3) interpretation — 변경 **전에** 그 사람이 겪던 일을 **행동**으로 쓴 짧은 문장. 해결책이 아니라 고통을 쓴다.
   예: "승인이 날 때까지 최대 13분을 기다림", "장애 알림이 오면 여러 도구를 열어 원인을 찾음", "상담원에게 같은 상황을 다시 설명함".
   원문에 그런 장면이 없으면 빈 문자열.

4) burden — 3)에 쓴 **변경 전의 고통**에 맞는 부담 하나. 아래 7개 중 하나, 또는 null.
${burdenGuide}
   판단 순서:
   ⓐ "자동화했다·도구를 만들었다"는 **해결 방식**이다. 그걸로 고르지 말고, 자동화 **전에** 사람이 무엇을 하며 힘들었는지(기다림? 찾음? 확인?)로 고른다.
   ⓑ time / search / decision / input / context / monitoring 중 맞는 게 있으면 그걸 고른다.
   ⓒ execution_burden 은 위 여섯이 모두 안 맞고, 사람이 하던 **여러 단계의 작업 절차**가 통째로 사라졌을 때만 고른다.
   ⚠️ 억지로 고르지 마라. 아래 경우는 null 이다:
   - 조직 문화·채용·온보딩·행사 후기·회고처럼 제품이나 업무 도구의 변화가 없는 글
   - 코드 구조 개선·리팩터링·용량 줄이기·성능 튜닝처럼 **사람이 무엇을 덜 하게 됐는지** 원문에 없는 글
   - 기술 개념 설명·소식 모음·참관기
   - "서버가 빨라졌다"는 있지만 그 빨라짐을 **누가 기다리지 않게 됐는지** 원문에 없는 글

5) fit — burden 이 이 글에 얼마나 들어맞나.
   - STRONG: 원문에 그 사람이 겪던 부담과 그것이 줄어든 장면이 **분명히 문장으로** 있다
   - WEAK: 부담이 줄었다고 볼 수는 있지만 원문이 주로 다루는 건 다른 이야기다
   - NONE: burden 이 null
6) evidence — fit 의 근거가 된 원문 문장을 **한 글자도 바꾸지 않고 그대로 복사**(20~120자). NONE 이면 빈 문자열.
7) secondary — 같은 글이 함께 덜어준 다른 부담의 경험(0~2개). 대표 경험은 넣지 마라. 확실할 때만.
   값: ${EXPERIENCES.join(", ")}
8) productPattern — 서비스가 개입한 방식. 아래 중 하나, 맞는 게 없거나 NONE 이면 null.
${ppGuide}
9) technologies — 그 방식을 실제로 구현한 기술 분류 1~3개: ${techGuide}
10) articleType — fit 이 NONE 일 때만: ${ARTICLE_TYPES.join(" / ")}. 아니면 null.

11) cardHeadline — 목록 카드에 크게 들어갈 **핵심 문장 하나**. 이 글을 처음 보는, 개발을 전혀 모르는 사람이 읽자마자 이해해야 한다.
   - **누가** + **무엇이 어떻게 달라졌는지**. 주어는 사람(고객, 사장님, 상담원, 개발자 …)이다.
   - 40자 이내, "~어요/~해요" 로 끝낸다.
   - 개발 용어·영어 기술 이름을 쓰지 마라(파이프라인, 아키텍처, 비동기, 렌더링, 임베딩, 캐시, 큐, 스레드, LLM, API …). "AI" 는 써도 된다.
   - 결론을 숨기는 낚시 문장, 과장, "~의 비밀" 같은 표현을 쓰지 마라. 숫자는 원문에 있는 것만.
   - 좋은 예: "주문 취소, 이제 앱에서 버튼 한 번이면 돼요" · "사장님 입점 승인이 10분에서 10초로 빨라졌어요" · "개발자가 장애 원인을 찾느라 로그를 뒤지지 않아도 돼요"
   - 나쁜 예: "비동기 큐로 로그 지연을 해결한 방법" · "LLM 기반 대화형 BI의 치명적 벽을 넘은 비결은?"`;

// 키 순서 = 생성 순서. 변경 전 행동(interpretation)을 먼저 쓰고 나서 burden 을 고르게 한다
const CLASSIFY_SCHEMA: Schema = obj({
  facts: obj({ problem: str(4), change: str(4), technology: str(2), result: str(2) }),
  beneficiary: { type: Type.STRING, enum: [...BENEFICIARIES] },
  interpretation: { type: Type.STRING },
  burden: { type: Type.STRING, enum: [...BURDENS], nullable: true },
  fit: { type: Type.STRING, enum: ["STRONG", "WEAK", "NONE"] },
  evidence: { type: Type.STRING },
  secondary: { type: Type.ARRAY, items: { type: Type.STRING, enum: [...EXPERIENCES] }, maxItems: "2" },
  productPattern: { type: Type.STRING, enum: [...PRODUCT_PATTERNS], nullable: true },
  technologies: { type: Type.ARRAY, items: { type: Type.STRING, enum: [...TECH_CATEGORIES] }, minItems: "1", maxItems: "3" },
  articleType: { type: Type.STRING, enum: [...ARTICLE_TYPES], nullable: true },
  cardHeadline: str(8),
});

type Raw = Omit<Classification, "experience"> & { cardHeadline: string };

/* ───────────── 코드 게이트 ───────────── */

const JARGON =
  /파이프라인|아키텍처|비동기|렌더링|임베딩|캐시|스레드|인프라|리팩터링|마이그레이션|레이턴시|오케스트레이션|프레임워크|컴포넌트|트래픽|쿼리|지오코딩|형상관리|디컴파일|커밋|브랜치|엔드포인트|스키마|로깅|번들/;
const ALLOWED_LATIN = new Set(["AI", "QR", "PDF", "SNS", "PC", "TV", "OK"]);

/** 썸네일 문장 규칙. 통과하면 null, 아니면 이유 */
export function headlineProblem(h: string, sourceText: string): string | null {
  return plainTextProblem(h, sourceText, 8, 40);
}

/** 누구나 읽는 문구 규칙 — 길이, "~요" 끝, 영어·개발 용어 금지, 숫자는 원문에 있는 것만 */
export function plainTextProblem(h: string, sourceText: string, min: number, max: number): string | null {
  const t = (h ?? "").trim();
  if (t.length < min || t.length > max) return `길이 ${t.length}자 (${min}~${max}자)`;
  if (!/요[.!?]?$/.test(t)) return "'~요'로 끝나지 않음";
  const latin = (t.match(/[A-Za-z]{2,}/g) ?? []).filter((w) => !ALLOWED_LATIN.has(w.toUpperCase()));
  if (latin.length) return `영어 용어: ${latin.join(", ")}`;
  const j = t.match(JARGON);
  if (j) return `개발 용어: ${j[0]}`;
  // 숫자는 단위까지 같이 원문에 있어야 한다 ("12분" ≠ 원문의 "12개")
  const flat = sourceText.replace(/\s+/g, "");
  const bad = [...t.matchAll(/(\d+(?:[.,]\d+)*)\s*([가-힣%])?/g)]
    .map((m) => m[1] + (m[2] ?? ""))
    .filter((n) => !flat.includes(n));
  if (bad.length) return `원문에 없는 숫자: ${bad.join(", ")}`;
  return null;
}

export function gateClassification(raw: Raw, html: string): { c: Classification; notes: string[] } {
  const notes: string[] = [];
  let burden: Burden | null = BURDENS.includes(raw.burden as Burden) ? (raw.burden as Burden) : null;
  let fit = raw.fit;

  // NONE ↔ burden 없음은 같이 가야 한다
  if (!burden) fit = "NONE";
  if (fit === "NONE") burden = null;

  // STRONG 은 원문 근거가 실제로 있어야 한다
  if (fit === "STRONG" && !excerptExists(html, raw.evidence)) {
    fit = "WEAK";
    notes.push("근거 문장을 원문에서 못 찾아 STRONG→WEAK");
  }

  // execution_burden 은 마지막 선택지 — 근거까지 약하면 경험으로 묶지 않는다
  if (burden === "execution_burden" && fit === "WEAK") {
    burden = null;
    fit = "NONE";
    notes.push("직접 처리 + 약함 → 해당 없음");
  }

  const experience: ExperienceKey | null = burden ? BURDEN_TO_EXPERIENCE[burden] : null;
  const c: Classification = {
    version: CLASSIFY_VERSION,
    facts: raw.facts,
    burden,
    beneficiary: raw.beneficiary,
    interpretation: burden ? raw.interpretation : "",
    fit,
    evidence: fit === "NONE" ? "" : raw.evidence,
    experience,
    secondary: experience ? [...new Set(raw.secondary ?? [])].filter((k) => k !== experience).slice(0, 2) : [],
    productPattern: fit === "NONE" ? null : (raw.productPattern ?? null),
    technologies: [...new Set(raw.technologies ?? [])].slice(0, 3),
    articleType: fit === "NONE" ? (raw.articleType ?? "기술 심화") : null,
  };
  return { c, notes };
}

/* ───────────── 실행 ───────────── */

export async function classifyExperience(
  title: string,
  text: string,
  html: string,
  log: (m: string) => void = () => {},
): Promise<{ classification: Classification; cardHeadline: string | null }> {
  const input = `제목: ${title}\n\n원문:\n${text}`;
  let raw = await json<Raw>(CLASSIFY_SYS, input, CLASSIFY_SCHEMA, 3000);
  let problem = headlineProblem(raw.cardHeadline ?? "", text);
  if (problem) {
    // 썸네일 문장만 다시 쓰게 한다
    log(`    · 카드 문장 규칙 위반(${problem}): ${raw.cardHeadline}`);
    const retry = await json<{ cardHeadline: string }>(
      CLASSIFY_SYS,
      `${input}\n\n[지난 cardHeadline "${raw.cardHeadline}" 이 규칙에 걸렸다: ${problem}. cardHeadline 만 규칙대로 다시 써라.]`,
      obj({ cardHeadline: str(8) }),
      300,
    );
    problem = headlineProblem(retry.cardHeadline ?? "", text);
    raw = { ...raw, cardHeadline: retry.cardHeadline };
  }
  const { c, notes } = gateClassification(raw, html);
  c.version = 2; // 가이드가 없는 글의 대체 경로 — v2 기준
  for (const n of notes) log(`    · ${n}`);
  return { classification: c, cardHeadline: problem ? null : raw.cardHeadline.trim() };
}

/* ═════════════ v3: "더 들어가 볼까요?" 칸 기준 매핑 ═════════════ */

const SECTION_SYS = `너는 테크 블로그 글을 "사람이 덜게 된 부담"으로 분류하는 편집자다.
입력은 이 글을 이미 정리한 "읽기 가이드"다 — 리드와, 글이 다룬 국면마다 하나씩인 칸(질문·문제·해결·결말).
원문 대신 이 칸들을 근거로 판단한다. 반드시 JSON 하나만 출력한다.

0) 칸을 보기 전에 **글 전체**에 대해 먼저 정한다.
   - change: 이 글에서 **실제로 바뀐 제품·서비스·업무 도구**를 한 문장으로. 무엇이 바뀌어 누가 무엇을 덜 하게 됐는지.
     그런 변화가 없으면 빈 문자열.
   - hasChange: change 가 있으면 true. ⚠️ 억지로 true 로 만들지 마라. 아래 글은 false 다:
     · 조직 문화·채용·온보딩·팀 운영 방식·행사 후기·회고·컨퍼런스 참관기
     · 마케팅·브랜딩·캠페인 소개, 기술 소식 모음, 기술 개념 설명
     · 코드 구조 개선·리팩터링·용량 줄이기·성능 튜닝처럼 **사람이 무엇을 덜 하게 됐는지** 글에 없는 글
     · "서버가 빨라졌다"는 있지만 그 빨라짐으로 **누가 기다리지 않게 됐는지** 글에 없는 글
     사내 개발자·운영자가 쓰는 도구가 바뀌어 그들의 일이 줄었다면 그것도 변화다(true).
   hasChange 가 false 면 1)의 모든 칸 burden 을 null 로 두고, 6) articleType 을 반드시 고른다.

1) sections — **칸마다 하나씩**, 준 칸을 전부. 각 칸을 아래 **경험 사슬** 세 고리로 읽는다.
   ① subject + difficulty: **누가**(사람·팀, 또는 기술적 문제 자체) **어떤 어려움**을 겪었나.
      기술 내부 문제도 어려움이다. 예) subject "장애 알림 시스템", difficulty "하나의 장애가 수십 개 알림으로 쪼개져 도착함"
   ② burdenText: **그 어려움 때문에 어떤 부담이 생겼나** — 그 부담을 진 사람이 실제로 하게 된 일로 쓴다.
      예) "담당자가 쏟아지는 알림을 하나씩 열어 원인을 찾아야 했음"
      예) subject 가 "AI 분석" 이고 difficulty 가 "성급하게 원인을 단정함" 이면 → "담당자가 잘못된 원인 보고를 받고 다시 확인해야 했음"
   ③ improvement: **어떤 기술로 어떻게** 그 부담을 좋은 방향으로 개선했나. 한 문장.
   ⚠️ 칸의 문제·해결·결말에 ①②③ 중 하나라도 단서가 없으면 지어내지 말고 그 고리를 빈 문자열로 둔다.
   - burden: ②의 부담에 맞는 부담 종류 하나. ①②③ 중 하나라도 비었으면 null.
${burdenGuide}
     판단 순서: ③의 "자동화했다·도구를 만들었다"는 해결 방식이다. 고르는 기준은 ②(해결 **전의** 부담)다.
     time / search / decision / input / context / monitoring 중 맞는 게 있으면 그걸 고르고,
     execution_burden 은 여섯이 모두 안 맞고 사람이 하던 **여러 단계의 작업 절차**가 통째로 사라졌을 때만.
     ⚠️ 억지로 고르지 마라. 그 칸이 기술 개념 설명·배경 소개·회고·소감이면 null 이다.
2) beneficiary — 이 글에서 부담을 덜게 된 주된 사람. 최종 사용자가 겪는 변화가 나오면 END_USER 를 먼저.
   END_USER(고객·사용자·입점 사장님·판매자 등 회사 바깥) / OPERATOR(개발자가 아닌 회사 안 사람) / DEVELOPER(개발자·QA·SRE)
3) technology — 이 글에서 쓴 기술을 한 문장으로.
4) productPattern — 서비스가 개입한 방식. 맞는 게 없으면 null.
${ppGuide}
5) technologies — 그 방식을 구현한 기술 분류 1~3개: ${techGuide}
6) articleType — 모든 칸의 burden 이 null 일 때만: ${ARTICLE_TYPES.join(" / ")}. 아니면 null.
7) cardHeadline — 목록 카드에 크게 들어갈 핵심 문장. 개발을 모르는 사람이 읽자마자 이해해야 한다.
   누가 + 무엇이 어떻게 달라졌는지. 40자 이내, "~어요/~해요" 로 끝. 개발 용어·영어 기술 이름 금지("AI" 는 허용).
   낚시·과장 금지, 숫자는 가이드에 있는 것만.
   좋은 예: "주문 취소, 이제 앱에서 버튼 한 번이면 돼요" · "개발자가 장애 원인을 찾느라 로그를 뒤지지 않아도 돼요"
8) problemTitle — 홈 "이런 문제를 어떻게 풀었을까요?" 카드의 **문제 제목**. 해결 전에 **누가 어떤 곤란을 겪었는지**.
   개발을 모르는 사람도 바로 이해하는 말, 30자 이내, "~어요/~했어요" 로 끝. 해결책은 쓰지 마라.
   개발 용어·영어 기술 이름 금지("AI" 허용). 원문 문장을 그대로 옮기지 말고 쉬운 말로 다시 쓴다.
   좋은 예: "고객이 엉뚱한 입구에서 줄을 섰어요" · "장애 알림이 수십 개씩 한꺼번에 쏟아졌어요"
   나쁜 예: "주소 대표점과 실제 접수 지점의 불일치" · "형상관리와 운영 서버의 소스 불일치"
9) problemSummary — 같은 카드의 **요약**. "어떤 문제를 어떻게 풀어 간 글인지" 가 보이게 **두 문장**, 90자 이내, "~어요/~해요" 로 끝.
   첫 문장 = 무엇이 문제였나, 둘째 문장 = 어떻게 풀었고 무엇이 달라졌나. 같은 규칙(쉬운 말, 개발 용어 금지, 숫자는 가이드에 있는 것만).
   좋은 예: "매장 위치를 주소로만 잡아서 고객이 실제 줄 서는 곳과 달랐어요. 매장이 접수 위치를 직접 정하게 바꿔 헛걸음을 줄였어요."`;

// 키 순서 = 생성 순서. 글 단위 판단(change → hasChange)을 칸 매핑보다 먼저 쓰게 한다
const SECTION_SCHEMA: Schema = obj({
  change: { type: Type.STRING },
  hasChange: { type: Type.BOOLEAN },
  sections: {
    type: Type.ARRAY,
    minItems: "1",
    items: obj({
      n: { type: Type.INTEGER },
      subject: { type: Type.STRING },
      difficulty: { type: Type.STRING },
      burdenText: { type: Type.STRING },
      improvement: { type: Type.STRING },
      burden: { type: Type.STRING, enum: [...BURDENS], nullable: true },
    }),
  },
  beneficiary: { type: Type.STRING, enum: [...BENEFICIARIES] },
  technology: str(2),
  productPattern: { type: Type.STRING, enum: [...PRODUCT_PATTERNS], nullable: true },
  technologies: { type: Type.ARRAY, items: { type: Type.STRING, enum: [...TECH_CATEGORIES] }, minItems: "1", maxItems: "3" },
  articleType: { type: Type.STRING, enum: [...ARTICLE_TYPES], nullable: true },
  cardHeadline: str(8),
  problemTitle: str(6),
  problemSummary: str(20),
});

type SectionRaw = {
  change: string;
  hasChange: boolean;
  problemTitle: string;
  problemSummary: string;
  sections: Omit<SectionMapping, "result">[];
  beneficiary: Classification["beneficiary"];
  technology: string;
  productPattern: Classification["productPattern"];
  technologies: Classification["technologies"];
  articleType: Classification["articleType"];
  cardHeadline: string;
};

/** 결말이 결과가 아니라 의도·필요·시작을 말하는 문장 */
const INTENT_ENDING = /(하려고|려고)\s*했어요|필요했어요|필요해요|시작했어요|예정이에요|계획이에요|고민했어요|노력했어요|목표였어요|목표예요|하고자 했어요/;

/**
 * 칸의 결말이 실제 결과인가 — 구조 규칙.
 * 숫자는 원문 전체에서 대조한다(결과 수치는 근거 블록이 아닌 다른 문단에 있는 경우가 많고,
 * "10:1" → "10대 1" 처럼 단위 표기가 바뀌어 쓰이기도 해서 숫자만 본다).
 */
export function isRealResult(outcome: string, sourceText: string): boolean {
  const t = (outcome ?? "").trim();
  if (t.length < 8) return false;
  if (INTENT_ENDING.test(t)) return false;
  const flat = sourceText.replace(/[\s,]+/g, "");
  return [...t.matchAll(/\d+(?:\.\d+)?/g)].every((m) => flat.includes(m[0]));
}

/**
 * 단어 사전 — 판단에 쓰지 않고 교차 확인에만 쓴다.
 * (단어로 매핑하면 "확인" 처럼 어디에나 나오는 말에 AI 보다 더 심하게 끌려간다)
 */
const BURDEN_WORDS: Record<Burden, RegExp> = {
  time_burden: /기다|대기|지연|느려|느린|오래 걸|로딩|늦어/,
  search_burden: /찾|헤매|검색|뒤지|탐색/,
  decision_burden: /비교|고민|선택지|판단|결정/,
  input_burden: /입력|작성|기입|채워|채우|등록/,
  context_burden: /다시 설명|재설명|반복해서 설명|맥락|매번 알려|다시 알려/,
  execution_burden: /직접 처리|수작업|손으로|수동/,
  monitoring_burden: /확인|검증|모니터|걱정|불안|들여다/,
};

export function gateFromSections(
  raw: SectionRaw,
  guide: ReadingGuide,
  blocks: Block[],
): { c: Classification; notes: string[] } {
  const notes: string[] = [];
  const review: string[] = [];
  const byN = new Map(raw.sections.map((s) => [s.n, s]));
  // v4 글 단위 확인 — 제품·업무 도구 변화가 없는 글은 칸에서 부담을 골랐어도 경험으로 묶지 않는다
  const noChange = raw.hasChange === false;
  if (noChange) notes.push("제품·업무 도구 변화 없음 → 해당 없음");

  const sourceText = blocks.map((b) => b.text).join("\n");
  const sections: SectionMapping[] = guide.sections.map((g, i) => {
    const n = i + 1;
    const r = byN.get(n);
    const subject = (r?.subject ?? "").trim();
    const difficulty = (r?.difficulty ?? "").trim();
    const burdenText = (r?.burdenText ?? "").trim();
    const improvement = (r?.improvement ?? "").trim();
    // 경험 사슬 ①②③ 이 모두 있어야 경험이다
    const chain = !!(subject && difficulty && burdenText && improvement);
    const burden = !noChange && chain && BURDENS.includes(r?.burden as Burden) ? (r!.burden as Burden) : null;
    const result = isRealResult(g.outcome, sourceText);
    if (burden) {
      const hits = BURDENS.filter((b) => BURDEN_WORDS[b].test(`${g.problem} ${burdenText}`));
      if (hits.length && !hits.includes(burden))
        review.push(`칸${n}: AI=${burden}, 단어=${hits.join("/")} — ${burdenText}`);
    }
    return { n, subject, difficulty, burdenText, improvement, burden, result };
  });

  // 대표 경험: 실제 결과가 있는 칸에서 가장 많이 나온 부담(같으면 글 앞쪽). 없으면 결과 없는 칸에서 → WEAK
  const pick = (list: SectionMapping[]) => {
    const count = new Map<Burden, { n: number; first: number }>();
    for (const s of list)
      if (s.burden) {
        const c = count.get(s.burden) ?? { n: 0, first: s.n };
        c.n++;
        count.set(s.burden, c);
      }
    return [...count.entries()].sort((a, b) => b[1].n - a[1].n || a[1].first - b[1].first)[0] ?? null;
  };
  const strong = pick(sections.filter((s) => s.result));
  const weak = strong ? null : pick(sections);
  let burden: Burden | null = (strong ?? weak)?.[0] ?? null;
  let fit: Classification["fit"] = strong ? "STRONG" : weak ? "WEAK" : "NONE";
  let primarySection: number | null = (strong ?? weak)?.[1].first ?? null;

  if (burden === "execution_burden" && fit === "WEAK") {
    notes.push("직접 처리 + 약함 → 해당 없음");
    burden = null;
    fit = "NONE";
    primarySection = null;
  }

  const experience: ExperienceKey | null = burden ? BURDEN_TO_EXPERIENCE[burden] : null;
  const secondary = [
    ...new Set(sections.filter((s) => s.burden && s.burden !== burden).map((s) => BURDEN_TO_EXPERIENCE[s.burden!])),
  ].slice(0, 2);
  const primary = primarySection ? sections[primarySection - 1] : null;
  const g0 = primarySection ? guide.sections[primarySection - 1] : null;

  return {
    notes,
    c: {
      version: CLASSIFY_VERSION,
      facts: {
        problem: guide.lead.why || guide.lead.what,
        change: raw.change?.trim() || guide.lead.how || guide.lead.what,
        technology: raw.technology,
        result: guide.lead.soWhat || "원문에 없음",
      },
      burden,
      beneficiary: raw.beneficiary,
      interpretation: primary ? `${primary.subject}: ${primary.difficulty} → ${primary.burdenText}` : "",
      fit,
      evidence: g0 ? `칸 ${primarySection}. ${g0.question} — ${g0.outcome || g0.problem}` : "",
      experience,
      secondary: experience ? secondary : [],
      productPattern: fit === "NONE" ? null : (raw.productPattern ?? null),
      technologies: [...new Set(raw.technologies ?? [])].slice(0, 3),
      articleType: fit === "NONE" ? (raw.articleType ?? "기술 심화") : null,
      sections,
      primarySection,
      review,
    },
  };
}

export async function classifyFromGuide(
  title: string,
  guide: ReadingGuide,
  html: string,
  text: string,
  log: (m: string) => void = () => {},
): Promise<{
  classification: Classification;
  cardHeadline: string | null;
  problemCard: { title: string; summary: string } | null;
}> {
  const blocks = splitBlocks(html);
  const lead = guide.lead;
  const input = [
    `제목: ${title}`,
    `리드 — 무엇을: ${lead.what} / 왜: ${lead.why} / 어떻게: ${lead.how} / 그래서: ${lead.soWhat}`,
    "",
    ...guide.sections.map(
      (s, i) =>
        `[칸 ${i + 1}] 질문: ${s.question}\n  문제: ${s.problem}\n  해결: ${s.paras.join(" ")}\n  결말: ${s.outcome || "(원문에 없음)"}`,
    ),
  ].join("\n");

  let raw = await json<SectionRaw>(SECTION_SYS, input, SECTION_SCHEMA, 3000);
  let problem = headlineProblem(raw.cardHeadline ?? "", text);
  if (problem) {
    log(`    · 카드 문장 규칙 위반(${problem}): ${raw.cardHeadline}`);
    const retry = await json<{ cardHeadline: string }>(
      SECTION_SYS,
      `${input}\n\n[지난 cardHeadline "${raw.cardHeadline}" 이 규칙에 걸렸다: ${problem}. cardHeadline 만 규칙대로 다시 써라.]`,
      obj({ cardHeadline: str(8) }),
      300,
    );
    problem = headlineProblem(retry.cardHeadline ?? "", text);
    raw = { ...raw, cardHeadline: retry.cardHeadline };
  }
  // 문제 카드 — 규칙에 걸리면 그 두 칸만 한 번 더 쓰게 한다
  const cardIssue = (r: { problemTitle: string; problemSummary: string }) =>
    plainTextProblem(r.problemTitle, text, 6, 30) ?? plainTextProblem(r.problemSummary, text, 20, 90);
  let card = { problemTitle: raw.problemTitle ?? "", problemSummary: raw.problemSummary ?? "" };
  let issue = cardIssue(card);
  if (issue) {
    log(`    · 문제 카드 규칙 위반(${issue}): ${card.problemTitle} / ${card.problemSummary}`);
    card = await json<typeof card>(
      SECTION_SYS,
      `${input}\n\n[지난 problemTitle "${card.problemTitle}" / problemSummary "${card.problemSummary}" 이 규칙에 걸렸다: ${issue}. 이 두 칸만 규칙대로 다시 써라.]`,
      obj({ problemTitle: str(6), problemSummary: str(20) }),
      400,
    );
    issue = cardIssue(card);
  }

  const { c, notes } = gateFromSections(raw, guide, blocks);
  for (const n of notes) log(`    · ${n}`);
  for (const r of c.review ?? []) log(`    ? 검토: ${r}`);
  return {
    classification: c,
    cardHeadline: problem ? null : raw.cardHeadline.trim(),
    problemCard: issue ? null : { title: card.problemTitle.trim(), summary: card.problemSummary.trim() },
  };
}
