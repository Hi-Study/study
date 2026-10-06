/** 공용 — 단계 사이를 오가는 데이터 모양 */
import type {
  ArticleType,
  Beneficiary,
  Burden,
  ExperienceKey,
  ExperiencePattern,
  Fit,
  ProductPatternKey,
  TechKey,
} from "../2-classify/taxonomy";

export type Audience = "PM" | "기획자" | "디자이너" | "데이터분석가" | "프로덕트오너";

/**
 * 경험 분류 — 피그마 구조화 프로세스를 단계별로 담는다.
 * experience 는 burden 에서 코드가 정한다(1:1). fit=NONE 이면 burden/experience 가 비고 articleType 이 붙는다.
 */
export interface Classification {
  /** 분류 프롬프트 버전 — 기준이 바뀌면 낮은 버전만 다시 돌린다 */
  version?: number;
  facts: { problem: string; change: string; technology: string; result: string };
  burden: Burden | null;
  beneficiary: Beneficiary;
  /** 사용자 관점 해석 — 부담을 사용자의 행동으로 쓴 문장 ("결과가 나올 때까지 기다림") */
  interpretation: string;
  fit: Fit;
  /** fit 판단 근거 — 원문 그대로의 문장. 원문에서 못 찾으면 STRONG 은 WEAK 로 내려간다 */
  evidence: string;
  experience: ExperienceKey | null;
  secondary: ExperienceKey[];
  productPattern: ProductPatternKey | null;
  technologies: TechKey[];
  articleType: ArticleType | null;
  /** v3: "더 들어가 볼까요?" 칸별 매핑 — 홈 분류의 근거를 상세 화면의 칸으로 추적할 수 있다 */
  sections?: SectionMapping[];
  /** 대표 경험을 정한 칸 번호(1부터) */
  primarySection?: number | null;
  /** 단어 사전 교차 확인에서 AI 판단과 어긋난 칸 — 자동으로 바꾸지 않고 점검용으로만 남긴다 */
  review?: string[];
}

/**
 * 칸 하나의 경험 사슬:
 * ① 누가(사람·팀·기술적 문제) 어떤 어려움을 겪었고 → ② 그 어려움으로 어떤 부담이 생겨서
 * → ③ 어떤 기술로 어떻게 좋은 방향으로 개선했다 → 그 경험(burden → experience)
 * 세 고리 중 하나라도 비면 그 칸은 경험이 없다(burden=null).
 */
export interface SectionMapping {
  n: number;
  /** ① 누가 — 사람·팀 또는 기술적 문제 */
  subject: string;
  /** ① 어떤 어려움 */
  difficulty: string;
  /** ② 그 어려움으로 생긴 부담 (사람이 하게 된 일) */
  burdenText: string;
  /** ③ 어떤 기술로 어떻게 개선했나 */
  improvement: string;
  burden: Burden | null;
  /** 결말이 실제 결과인가 (의도·필요·시작이 아니고, 숫자가 근거 블록에 있음) */
  result: boolean;
}

/** 2차 상세 분석 결과 — articles.learning_json */
export interface Learning {
  /** 썸네일 핵심 문장 — 처음 보는 사람도 바로 이해하는 말 */
  cardHeadline?: string;
  /** 홈 "이런 문제를 어떻게 풀었을까요?" 카드 — 문제 제목 + 어떻게 풀었는지 요약 (쉬운 말) */
  problemCard?: { title: string; summary: string };
  classification?: Classification;
  hook: string;
  tags: string[];
  audience: Audience;
  difficulty: "입문" | "중급" | "심화";
  readingTime: number;
  conclusion: string;
  before: string;
  after: string;
  experiencePattern: ExperiencePattern;
  productPatterns: string[];
  plannerQuestions: string[];
  tradeoffs: { benefits: string[]; considerations: string[] };
  quickView: { summary: string[]; whyItMatters: string[]; keywords: string[] };
  problem: { items: { title: string; description: string; originalExcerpt: string }[] };
  technology: {
    name: string;
    simpleExplanation: string;
    plannerExplanation: string;
    originalExcerpt: string;
  }[];
  experienceImpact: {
    technology: string;
    capability: string;
    uxImpact: string;
    description: string;
    originalExcerpt: string;
  }[];
  discussionQuestions: { question: string; options: string[] }[];
}

/** "더 들어가 볼까요?" — articles.reading_guide_json */
export interface ReadingGuide {
  lead: { what: string; why: string; how: string; soWhat: string };
  points: string[];
  sections: GuideSection[];
  terms: { term: string; plain: string }[];
}

export interface GuideSection {
  question: string;
  problem: string;
  paras: string[];
  outcome: string;
  /** 근거 원문 블록 번호 (1부터) */
  blocks: number[];
  terms: string[];
}

export type ArticleStatus = "pending" | "included" | "excluded";

export interface Company {
  id: string;
  name: string;
  color: string;
  blogUrl: string;
  feedUrl: string | null;
  /** 로고를 받을 회사 공식 사이트 — 블로그가 Medium 처럼 플랫폼에 있어 로고가 없을 때 */
  homeUrl?: string;
  /** RSS 가 없는 블로그: 목록 페이지에서 글 링크를 찾는다 */
  listPage?: { url: string; linkPattern: string };
}

export interface ArticleRow {
  id: number;
  companyId: string;
  title: string;
  url: string;
  publishedAt: string;
  contentHtml: string;
  status: ArticleStatus;
  exclusionReason: string | null;
  learning: Learning | null;
  guide: ReadingGuide | null;
  /** 대표 이미지 — 없으면 null (화면이 회사 로고·색으로 대신한다) */
  thumbnail: string | null;
}
