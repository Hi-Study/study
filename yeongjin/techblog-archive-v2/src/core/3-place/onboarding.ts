/**
 * 직군별 개인화 온보딩 — 직군·관심사 정의와 규칙 기반 추천.
 * AI/LLM 호출 없음 — 기존 분류 체계(2-classify/taxonomy.ts)만 가지고 고른다.
 * 기준 문서: 2026-11-24 전달받은 "INSIGHT. 관점 아카이브 — 직군별 개인화 온보딩 구축" 스펙 5~10절.
 */
import { cls, internalOf } from "./home";
import type { ExperienceKey, TechKey } from "../2-classify/taxonomy";
import type { ArticleRow } from "../shared/types";

export const ROLES = ["PLANNER", "DESIGNER", "DEVELOPER", "STRATEGY", "MARKETER", "LEARNER"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_META: Record<Role, { label: string; valueProp: string; title: string; description: string }> = {
  PLANNER: {
    label: "서비스 기획자·PM",
    valueProp: "새로운 서비스 개선 아이디어",
    title: "기술을 새로운 기획 아이디어로.",
    description: "다른 서비스가 어떤 문제를 발견하고, 기술로 어떻게 해결했는지 살펴보세요. 우리 서비스에 적용할 새로운 아이디어를 발견할 수 있어요.",
  },
  DESIGNER: {
    label: "UX/UI 디자이너",
    valueProp: "더 나은 사용자 경험 설계",
    title: "기술을 더 나은 사용자 경험으로.",
    description: "기술이 사용자의 기다림과 고민, 반복적인 행동을 어떻게 줄였는지 살펴보세요.",
  },
  DEVELOPER: {
    label: "개발자",
    valueProp: "기술의 활용 방식과 서비스 가치",
    title: "코드 너머의 서비스 가치를 발견해요.",
    description: "기술이 도입된 이유부터 사용자와 비즈니스에 가져온 변화까지 함께 살펴보세요.",
  },
  STRATEGY: {
    label: "사업·전략 기획자",
    valueProp: "기술이 만드는 새로운 사업 기회",
    title: "기술의 변화에서 사업 기회를 찾아요.",
    description: "다른 기업의 기술 활용 사례에서 운영 혁신과 새로운 사업의 가능성을 발견해 보세요.",
  },
  MARKETER: {
    label: "마케터·MD",
    valueProp: "고객 경험과 구매 전환 개선",
    title: "기술로 달라지는 고객 행동을 발견해요.",
    description: "추천과 검색, 개인화 기술이 고객의 탐색과 선택을 어떻게 바꾸는지 살펴보세요.",
  },
  LEARNER: {
    label: "기타·학습자",
    valueProp: "기술과 서비스를 쉽게 이해하기",
    title: "어려운 기술을 일상의 경험으로.",
    description: "복잡한 기술 용어보다 실제 서비스가 어떤 문제를 어떻게 해결했는지 쉽게 이해해 보세요.",
  },
};

/** STEP 03 — 선택한 직군으로 같은 글을 다시 볼 때 던지는 질문. 특정 글 내용을 가정하지 않는 일반형 질문이다. */
export const ROLE_PERSPECTIVE_QUESTION: Record<Role, string> = {
  PLANNER: "개발 리소스를 많이 들이지 않고도 비슷한 문제를 풀 수 있는 영역은 무엇일까요?",
  DESIGNER: "이 경험을 적용한다면 사용자에게 어떤 안내나 피드백이 더 필요할까요?",
  DEVELOPER: "이 방식을 우리 서비스에 적용한다면 어떤 기술 환경이 먼저 필요할까요?",
  STRATEGY: "이 사례를 조직의 효율이나 새로운 사업 기회로 어떻게 연결할 수 있을까요?",
  MARKETER: "이 변화가 고객의 탐색이나 구매 결정에 어떤 영향을 줄 수 있을까요?",
  LEARNER: "이 사례를 통해 어떤 기술을 가장 쉽게 이해할 수 있었나요?",
};

/** 홈 개인화 영역 타이틀 — 스펙 11절 */
export const ROLE_HOME_TITLE: Record<Role, string> = {
  PLANNER: "오늘은 어떤 기획 아이디어를 발견해 볼까요?",
  DESIGNER: "오늘은 어떤 사용자 경험을 발견해 볼까요?",
  DEVELOPER: "오늘은 기술이 만드는 어떤 가치를 살펴볼까요?",
  STRATEGY: "오늘은 어떤 새로운 사업 가능성을 발견해 볼까요?",
  MARKETER: "오늘은 고객 경험을 어떻게 개선해 볼까요?",
  LEARNER: "오늘은 어떤 기술과 서비스를 알아볼까요?",
};

export type Interest = { id: string; label: string };

/** STEP 02 — 직군별 기본 관심사(4개씩). 같은 뜻이면 같은 id 를 재사용한다(공통 관심사로도 고를 수 있게). */
export const ROLE_INTERESTS: Record<Role, Interest[]> = {
  PLANNER: [
    { id: "service_improvement", label: "서비스 개선 사례" },
    { id: "ai_feature_planning", label: "AI 기능 기획" },
    { id: "problem_solving", label: "문제 해결 방식" },
    { id: "work_automation", label: "업무 자동화" },
  ],
  DESIGNER: [
    { id: "user_pain_relief", label: "사용자 불편 해소" },
    { id: "personalized_ux", label: "개인화 UX" },
    { id: "ai_interaction", label: "AI 인터랙션" },
    { id: "design_efficiency", label: "디자인 효율화" },
  ],
  DEVELOPER: [
    { id: "ai_agent_interest", label: "AI 에이전트" },
    { id: "tech_adoption_case", label: "기술 적용 사례" },
    { id: "dev_productivity", label: "개발 생산성" },
    { id: "service_architecture", label: "서비스 아키텍처" },
  ],
  STRATEGY: [
    { id: "business_innovation", label: "비즈니스 혁신" },
    { id: "ops_efficiency", label: "운영 효율화" },
    { id: "ai_strategy", label: "AI 도입 전략" },
    { id: "new_business_idea", label: "신규 사업 아이디어" },
  ],
  MARKETER: [
    { id: "product_recommendation", label: "상품 추천" },
    { id: "customer_personalization", label: "고객 개인화" },
    { id: "conversion_improvement", label: "구매 전환" },
    { id: "work_automation", label: "업무 효율화" },
  ],
  LEARNER: [
    { id: "ai_trend", label: "AI 트렌드" },
    { id: "service_case", label: "서비스 사례" },
    { id: "tech_made_easy", label: "기술 쉽게 이해하기" },
    { id: "work_automation", label: "업무 자동화" },
  ],
};

/** AI 기술 느낌의 "요즘 자주 나오는 기술" 묶음 — BUCKET_TECHS(넓은 바구니)는 뺀다 */
const AI_TECH_CLUSTER: TechKey[] = [
  "LLM", "AI_AGENT", "RAG", "RECOMMENDATION", "CONTEXT_AI", "ON_DEVICE_AI",
  "COMPUTER_VISION", "VECTOR_SEARCH", "EDGE_COMPUTING", "SPEECH_AI",
];

/**
 * 관심사 id → 기존 taxonomy 매핑. 자유 텍스트 태그(learning.tags)는 안 쓴다(불안정해서).
 * experiences/techs 가 비어 있으면 "특정 분류에 치우치지 않는 폭넓은 관심"으로 보고 점수에 가산하지 않는다 —
 * 추천이 억지로 끼워 맞추는 것보다 비워 두는 쪽을 택한다(존재하지 않는 근거를 만들지 않는다).
 */
export const INTEREST_MAP: Record<string, { experiences?: ExperienceKey[]; techs?: TechKey[]; internal?: boolean }> = {
  ai_feature_planning: { techs: ["LLM", "AI_AGENT"] },
  work_automation: { experiences: ["DO_LESS"], techs: ["API_INTEGRATION"] },
  user_pain_relief: { experiences: ["WAIT_LESS", "INPUT_LESS"] },
  personalized_ux: { experiences: ["REPEAT_LESS"], techs: ["RECOMMENDATION"] },
  ai_interaction: { techs: ["LLM", "AI_AGENT", "CONTEXT_AI"] },
  design_efficiency: { experiences: ["DO_LESS"] },
  ai_agent_interest: { techs: ["AI_AGENT"] },
  tech_adoption_case: { techs: AI_TECH_CLUSTER },
  dev_productivity: { experiences: ["DO_LESS"], internal: true },
  service_architecture: { techs: ["APP_ARCHITECTURE"] },
  ops_efficiency: { experiences: ["DO_LESS"], internal: true },
  ai_strategy: { techs: ["LLM", "AI_AGENT"], internal: true },
  product_recommendation: { experiences: ["COMPARE_LESS"], techs: ["RECOMMENDATION"] },
  customer_personalization: { experiences: ["REPEAT_LESS"], techs: ["RECOMMENDATION"] },
  conversion_improvement: { experiences: ["COMPARE_LESS"], techs: ["RECOMMENDATION"] },
  ai_trend: { techs: AI_TECH_CLUSTER },
  // service_improvement · problem_solving · business_innovation · new_business_idea ·
  // service_case · tech_made_easy — 의도적으로 매핑을 비워 둔다(위 주석 참고)
};

const INTEREST_LABEL: Record<string, string> = Object.fromEntries(
  Object.values(ROLE_INTERESTS).flatMap((list) => list.map((i) => [i.id, i.label])),
);

export type Recommendation = { article: ArticleRow; reason: string };

/**
 * 스펙 10절 우선순위: ① 선택한 관심사 일치 ② 직군 기본 관심사 ③ taxonomy 관련성 ④ 안 읽은 글 ⑤ 최신순.
 * ④(안 읽은 글)는 여기서 가리지 않는다 — 화면이 기존 ReadFilter/HomeReadScope(이미 읽은 글을 브라우저·계정
 * 기준으로 숨기는 컴포넌트)로 감싸는 쪽이 중복 로직 없이 같은 기준을 유지한다.
 */
export function recommendFor(rows: ArticleRow[], role: Role, interestIds: string[], limit = 3): Recommendation[] {
  const selected = interestIds.length > 0 ? interestIds : ROLE_INTERESTS[role].map((i) => i.id);
  const scored = rows
    .map((a) => {
      const c = cls(a);
      if (!c || c.fit === "NONE") return null;
      let score = c.fit === "STRONG" ? 1 : 0;
      let matchedInterest: string | null = null;
      for (const id of selected) {
        const m = INTEREST_MAP[id];
        if (!m) continue;
        let hit = 0;
        if (m.experiences?.includes(c.experience as ExperienceKey)) hit += 2;
        hit += c.technologies.filter((t) => m.techs?.includes(t)).length;
        if (m.internal && internalOf(a)) hit += 1;
        if (hit > 0 && !matchedInterest) matchedInterest = id;
        score += hit;
      }
      return { article: a, score, matchedInterest };
    })
    .filter((x): x is { article: ArticleRow; score: number; matchedInterest: string | null } => x !== null)
    .sort((a, b) => b.score - a.score || new Date(b.article.publishedAt).getTime() - new Date(a.article.publishedAt).getTime());

  const picked = scored.filter((x) => x.score > 1).slice(0, limit);
  const pickedIds = new Set(picked.map((x) => x.article.id));
  // 관심사와 맞는 글이 부족하면 최신 포함 글로 채운다(스펙: "대체 추천")
  for (const a of rows) {
    if (picked.length >= limit) break;
    if (pickedIds.has(a.id)) continue;
    picked.push({ article: a, score: 0, matchedInterest: null });
    pickedIds.add(a.id);
  }

  return picked.slice(0, limit).map(({ article, matchedInterest }) => ({
    article,
    reason: matchedInterest ? `관심 있는 ${INTEREST_LABEL[matchedInterest]}와 관련된 사례예요.` : "최신 사례예요.",
  }));
}
