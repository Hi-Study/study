/** 분류 체계 — 4단계 부담·경험, 5단계 누구의 부담, 6단계 적합도·글 성격, 7단계 방식·기술. 기준 문서: docs/01_분류기준.md */
/**
 * 콘텐츠 구조화 분류 체계 (피그마 "01. 콘텐트 구조화 프로세스 상세")
 * 원문 → FACT → Problem Taxonomy → 사용자 관점 해석 → Experience Pattern → Product Pattern → Technology
 *
 * Problem Taxonomy(부담 종류)와 Experience Pattern 은 1:1 로 대응한다.
 * AI 는 부담을 고르고, 경험은 코드가 정한다 — 두 값이 어긋날 수 없게.
 */

export const BURDENS = [
  "time_burden",
  "search_burden",
  "decision_burden",
  "input_burden",
  "context_burden",
  "execution_burden",
  "monitoring_burden",
] as const;
export type Burden = (typeof BURDENS)[number];

export const EXPERIENCES = ["WAIT_LESS", "SEARCH_LESS", "COMPARE_LESS", "INPUT_LESS", "REPEAT_LESS", "DO_LESS", "CHECK_LESS"] as const;
export type ExperienceKey = (typeof EXPERIENCES)[number];

export const BURDEN_TO_EXPERIENCE: Record<Burden, ExperienceKey> = {
  time_burden: "WAIT_LESS",
  search_burden: "SEARCH_LESS",
  decision_burden: "COMPARE_LESS",
  input_burden: "INPUT_LESS",
  context_burden: "REPEAT_LESS",
  execution_burden: "DO_LESS",
  monitoring_burden: "CHECK_LESS",
};

/**
 * when/short/benefit — 홈 경험 카드 문구. 읽는 기획자가 "우리 사용자도 이런가?" → "이런 경험을 줘야 하는데" → "다른 서비스는 어떻게 했지?" 로 이어지게
 *   when: 우리 서비스에 비춰 보는 질문 · short: 전달할 경험 · benefit: 다른 서비스 사례로 이끄는 질문
 * question/how — 경험 페이지 머리말
 */
export const EXPERIENCE_META: Record<
  ExperienceKey,
  {
    label: string;
    slug: string;
    /** 홈 카드 맨 위 상황 문구 — "~했다면" */
    when: string;
    short: string;
    benefit: string;
    question: string;
    how: string;
    burden: string;
  }
> = {
  WAIT_LESS: {
    when: "사용자가 결과를 한참 기다리나요?",
    short: "기다림 없는 경험",
    benefit: "기다림을 어떻게 줄였을까요?",
    label: "기다리지 않아도 되는 경험",
    slug: "wait-less",
    question: "사용자를 기다리지 않게 하려면?",
    how: "결과를 기다리는 시간을 줄이는 방법",
    burden: "결과가 나올 때까지 기다림",
  },
  SEARCH_LESS: {
    when: "사용자가 원하는 걸 찾아 헤매나요?",
    short: "찾지 않아도 보이는 경험",
    benefit: "어떻게 먼저 보여줄까요?",
    label: "찾지 않아도 되는 경험",
    slug: "search-less",
    question: "사용자가 직접 찾지 않게 하려면?",
    how: "탐색 없이 원하는 걸 바로 보여주는 방법",
    burden: "원하는 걸 찾아 헤맴",
  },
  COMPARE_LESS: {
    when: "사용자가 고르느라 고민하나요?",
    short: "고민을 덜어 주는 경험",
    benefit: "선택지를 어떻게 줄였을까요?",
    label: "비교하지 않아도 되는 경험",
    slug: "compare-less",
    question: "사용자가 직접 비교하지 않게 하려면?",
    how: "적합한 선택지를 먼저 좁혀주는 방법",
    burden: "여러 선택지를 비교하며 고민함",
  },
  INPUT_LESS: {
    when: "사용자가 같은 정보를 또 입력하나요?",
    short: "다시 입력하지 않는 경험",
    benefit: "입력을 어떻게 줄였을까요?",
    label: "입력하지 않아도 되는 경험",
    slug: "input-less",
    question: "사용자가 직접 입력하지 않게 하려면?",
    how: "정보를 대신 가져오거나 채워주는 방법",
    burden: "같은 정보를 반복해서 입력함",
  },
  REPEAT_LESS: {
    when: "사용자가 매번 처음부터 다시 시작하나요?",
    short: "나를 기억해 주는 경험",
    benefit: "지난 이용을 어떻게 이어 줄까요?",
    label: "다시 설명하지 않아도 되는 경험",
    slug: "repeat-less",
    question: "사용자가 다시 설명하지 않게 하려면?",
    how: "이전 맥락과 상황을 이어가는 방법",
    burden: "같은 상황을 처음부터 다시 설명함",
  },
  DO_LESS: {
    when: "사용자가 여러 단계를 손수 처리하나요?",
    short: "알아서 처리되는 경험",
    benefit: "무엇을 대신 해 줄까요?",
    label: "직접 처리하지 않아도 되는 경험",
    slug: "do-less",
    question: "사용자가 직접 처리하지 않게 하려면?",
    how: "여러 단계를 대신 수행하는 방법",
    burden: "여러 단계를 손으로 직접 처리함",
  },
  CHECK_LESS: {
    when: "사용자가 잘 됐는지 계속 확인하나요?",
    short: "확인하지 않아도 안심되는 경험",
    benefit: "어떻게 먼저 알려 줄까요?",
    label: "확인하지 않아도 되는 경험",
    slug: "check-less",
    question: "사용자가 계속 확인하지 않게 하려면?",
    how: "상태를 대신 지켜보고 알려주는 방법",
    burden: "잘 됐는지 계속 들여다보며 확인함",
  },
};

export const experienceBySlug = (slug: string) =>
  EXPERIENCES.find((k) => EXPERIENCE_META[k].slug === slug) ?? null;

/** 누구의 부담이 줄었나 — 사내 운영자·개발자는 태그로 따로 표기한다 */
export const BENEFICIARIES = ["END_USER", "OPERATOR", "DEVELOPER"] as const;
export type Beneficiary = (typeof BENEFICIARIES)[number];
export const BENEFICIARY_LABEL: Record<Beneficiary, string> = {
  END_USER: "서비스 사용자",
  OPERATOR: "사내 운영자",
  DEVELOPER: "개발자",
};
export const isInternal = (b: Beneficiary | undefined) => b === "OPERATOR" || b === "DEVELOPER";
export const INTERNAL_TAG = "사내 운영·개발 경험";

/** 경험에 얼마나 들어맞나. NONE 이면 경험 테마에 넣지 않는다 */
export const FITS = ["STRONG", "WEAK", "NONE"] as const;
export type Fit = (typeof FITS)[number];

/** 경험으로 묶이지 않는 글의 성격 — 피드·검색에는 남는다 */
export const ARTICLE_TYPES = ["조직·문화", "기술 심화", "행사·회고"] as const;
export type ArticleType = (typeof ARTICLE_TYPES)[number];

export const PRODUCT_PATTERNS = [
  "LOCAL_FIRST_PROCESSING",
  "CANDIDATE_REDUCTION",
  "AUTO_COMPARISON",
  "CONTEXT_CONTINUITY",
  "PROACTIVE_SUGGESTION",
  "DELEGATED_EXECUTION",
  "PROACTIVE_MONITORING",
  "AUTO_INPUT",
  "EXPLANATION_LAYER",
] as const;
export type ProductPatternKey = (typeof PRODUCT_PATTERNS)[number];
export const PRODUCT_PATTERN_LABEL: Record<ProductPatternKey, string> = {
  LOCAL_FIRST_PROCESSING: "바로 처리 가능한 것은 먼저 처리하는 방식",
  CANDIDATE_REDUCTION: "선택지를 먼저 줄여주는 방식",
  AUTO_COMPARISON: "조건을 대신 비교하는 방식",
  CONTEXT_CONTINUITY: "이전 상황을 이어서 이해하는 방식",
  PROACTIVE_SUGGESTION: "찾기 전에 먼저 제안하는 방식",
  DELEGATED_EXECUTION: "다음 행동까지 대신 처리하는 방식",
  PROACTIVE_MONITORING: "사용자가 확인하기 전에 먼저 알려주는 방식",
  AUTO_INPUT: "정보를 대신 가져오거나 입력하는 방식",
  EXPLANATION_LAYER: "결과의 이유를 함께 설명하는 방식",
};

/** 좁은 자리(카드의 근거 행 등)용 짧은 이름 */
export const PRODUCT_PATTERN_SHORT: Record<ProductPatternKey, string> = {
  LOCAL_FIRST_PROCESSING: "먼저 처리하기",
  CANDIDATE_REDUCTION: "선택지 줄여주기",
  AUTO_COMPARISON: "대신 비교하기",
  CONTEXT_CONTINUITY: "맥락 이어가기",
  PROACTIVE_SUGGESTION: "먼저 제안하기",
  DELEGATED_EXECUTION: "대신 실행하기",
  PROACTIVE_MONITORING: "먼저 알려주기",
  AUTO_INPUT: "대신 입력하기",
  EXPLANATION_LAYER: "이유 설명하기",
};

/** 피그마 TechnologyCategory 11개 + AI 가 아닌 글을 받기 위한 3개 */
export const TECH_CATEGORIES = [
  "LLM",
  "AI_AGENT",
  "RAG",
  "RECOMMENDATION",
  "CONTEXT_AI",
  "ON_DEVICE_AI",
  "COMPUTER_VISION",
  "VECTOR_SEARCH",
  "EDGE_COMPUTING",
  "SPEECH_AI",
  "API_INTEGRATION",
  "DATA_PLATFORM",
  "INFRA_PERFORMANCE",
  "APP_ARCHITECTURE",
] as const;
export type TechKey = (typeof TECH_CATEGORIES)[number];

/**
 * 기술 이름이 아니라 넓은 바구니인 분류 — 홈 "요즘 자주 나오는 기술" 키워드에서는 뺀다.
 * (워크숍 후기·웰컴키트까지 "앱·웹 화면 구조"로 들어가는 등 서로 다른 글이 한 칸에 섞였다)
 * 분류 데이터에는 남기고 기술 페이지 주소로는 들어갈 수 있다. 진짜 기술 키워드 목록(v4 후보)으로 대체 예정.
 */
export const BUCKET_TECHS: readonly TechKey[] = ["DATA_PLATFORM", "INFRA_PERFORMANCE", "APP_ARCHITECTURE"];
export const TECH_LABEL: Record<TechKey, string> = {
  LLM: "생성형 AI",
  AI_AGENT: "AI 에이전트",
  RAG: "사내 지식 검색 AI",
  RECOMMENDATION: "추천",
  CONTEXT_AI: "맥락 이해 AI",
  ON_DEVICE_AI: "기기 안에서 도는 AI",
  COMPUTER_VISION: "이미지 인식",
  VECTOR_SEARCH: "의미 기반 검색",
  EDGE_COMPUTING: "엣지 컴퓨팅",
  SPEECH_AI: "음성 AI",
  API_INTEGRATION: "외부 서비스 연동",
  DATA_PLATFORM: "데이터·실험 플랫폼",
  INFRA_PERFORMANCE: "서버·성능 개선",
  APP_ARCHITECTURE: "앱·웹 화면 구조",
};

/** 기술 키워드 페이지 설명 — 개발을 모르는 사람이 읽는 한 줄 */
export const TECH_DESC: Record<TechKey, string> = {
  LLM: "글을 읽고 쓰고 요약하는 AI. 사람이 하던 말·글 작업을 대신해요.",
  AI_AGENT: "목표를 주면 스스로 도구를 골라 여러 단계를 처리하는 AI예요.",
  RAG: "회사 문서·지식을 찾아 근거로 붙여 답하는 AI예요.",
  RECOMMENDATION: "사람마다 맞는 상품·콘텐츠를 골라 먼저 보여주는 기술이에요.",
  CONTEXT_AI: "이전 대화와 상황을 기억해 이어서 이해하는 AI예요.",
  ON_DEVICE_AI: "서버로 보내지 않고 휴대폰·기기 안에서 바로 도는 AI예요.",
  COMPUTER_VISION: "사진·영상 속 물건이나 얼굴을 알아보는 기술이에요.",
  VECTOR_SEARCH: "단어가 달라도 뜻이 비슷한 것을 찾아주는 검색이에요.",
  EDGE_COMPUTING: "사용자와 가까운 곳에서 처리해 응답을 빠르게 하는 기술이에요.",
  SPEECH_AI: "말을 알아듣거나 목소리로 답하는 AI예요.",
  API_INTEGRATION: "다른 서비스·시스템과 데이터를 주고받게 연결하는 기술이에요.",
  DATA_PLATFORM: "지표·실험·데이터를 한곳에서 만들고 보는 사내 도구예요.",
  INFRA_PERFORMANCE: "서버를 더 빠르고 안정적으로 돌리는 개선이에요.",
  APP_ARCHITECTURE: "앱·웹 화면을 어떻게 나눠 만들지에 대한 구조 설계예요.",
};
export const techSlug = (k: TechKey) => k.toLowerCase().replace(/_/g, "-");
export const techBySlug = (slug: string) => TECH_CATEGORIES.find((k) => techSlug(k) === slug) ?? null;

/* ── v01 호환: 예전 데이터는 한글 경험 라벨 하나만 갖고 있다 ── */
export const EXPERIENCE_PATTERNS = EXPERIENCES.map((k) => EXPERIENCE_META[k].label);
export type ExperiencePattern = string;
export const experienceByLabel = (label: string) =>
  EXPERIENCES.find((k) => EXPERIENCE_META[k].label === label) ?? null;
