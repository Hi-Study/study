// 아티클 자동 분류 — 고정 7주제(topic) 1개 + 태그(tags) 여러 개를 키워드 규칙으로 뽑는다.
// LLM 없이(무료·즉시) 동작. 정확도보다 "대략 맞는 분류 + 검색 태그" 확보가 목적.
// 규칙 순서 = 우선순위: 앞선(구체적) 주제가 동점 시 이긴다. dev 는 가장 광범위해 맨 뒤.

export type Topic = "dev" | "product" | "design" | "planning" | "data_ai" | "infra" | "career";

const RULES: { topic: Topic; kw: RegExp }[] = [
  {
    topic: "data_ai",
    kw: /(머신\s*러닝|딥\s*러닝|LLM|GPT|생성형|추천\s*시스템|데이터\s*엔지니어|데이터\s*분석|데이터\s*플랫폼|임베딩|벡터\s*(디비|DB|검색)|하둡|스파크|Spark|Airflow|BigQuery|피처\s*스토어|feature\s*store|모델\s*(학습|서빙)|파이프라인)/i,
  },
  {
    topic: "infra",
    kw: /(쿠버네티스|Kubernetes|k8s|도커|Docker|CI\/CD|인프라|MSA|마이크로\s*서비스|카프카|Kafka|트래픽|부하|스케일|서버리스|Serverless|Terraform|모니터링|옵저버빌리티|SRE|가용성|장애\s*대응|데이터베이스\s*튜닝|쿼리\s*최적화)/i,
  },
  {
    topic: "design",
    kw: /(디자인\s*시스템|디자인\s*토큰|UI\/UX|UX\s*라이팅|피그마|Figma|타이포그래피|접근성|a11y|모션\s*(디자인|가이드)|인터랙션\s*디자인|브랜드\s*경험|컴포넌트\s*디자인)/i,
  },
  {
    topic: "planning",
    kw: /(기획|PM\b|PO\b|프로덕트\s*매니저|요구사항|스펙\s*정의|로드맵|우선순위|지표|KPI|OKR|퍼널|A\/B\s*테스트|실험\s*설계|가설|유저\s*리서치|와이어프레임)/i,
  },
  {
    topic: "career",
    kw: /(회고|성장|채용|면접|온보딩|조직\s*문화|팀\s*빌딩|리더십|커리어|주니어|시니어|일하는\s*방식|협업\s*문화|스크럼|애자일|agile)/i,
  },
  {
    topic: "product",
    kw: /(서비스\s*(출시|런칭|개선)|리뉴얼|사용자\s*경험|고객\s*경험|전환율|리텐션|결제|주문|배송|물류|재고|POS|커머스|구독|프로모션|쿠폰|장바구니|검색\s*품질|추천\s*상품|그로스|funnel)/i,
  },
  {
    topic: "dev",
    kw: /(리팩터|리팩토링|프론트\s*엔드|백\s*엔드|React|리액트|Vue|Spring|스프링|Kotlin|코틀린|자바|자바스크립트|타입스크립트|TypeScript|GraphQL|REST\s*API|테스트\s*코드|성능\s*최적화|아키텍처|시스템\s*설계|구조를?\s*(다시\s*)?설계|모듈화|라이브러리|프레임워크|버그|디버깅)/i,
  },
];

// 검색·필터용 태그 후보(발견되면 원형 그대로 태그로 채택).
const TAG_TOKENS = [
  "React", "Vue", "Next.js", "Nuxt", "Kotlin", "Spring", "Node.js", "GraphQL", "TypeScript",
  "Kafka", "Kubernetes", "Docker", "AWS", "MSA", "Redis", "MySQL", "PostgreSQL", "Elasticsearch",
  "LLM", "머신러닝", "추천", "데이터", "결제", "디자인 시스템", "접근성", "성능", "테스트",
  "회고", "채용", "온보딩", "A/B 테스트", "리팩토링", "모니터링", "보안", "캐시",
];

function countMatches(hay: string, re: RegExp): number {
  return (hay.match(new RegExp(re.source, "gi")) ?? []).length;
}

/** 제목·본문 → { topic(가장 강한 주제 or null), tags(최대 6개) } */
export function classify(title: string, body: string): { topic: Topic | null; tags: string[] } {
  const short = body.slice(0, 4000);
  // 제목 가중치 3배(제목이 주제를 가장 잘 드러냄).
  const hay = `${title}\n${title}\n${title}\n${short}`;

  let topic: Topic | null = null;
  let bestN = 0;
  for (const r of RULES) {
    const n = countMatches(hay, r.kw);
    if (n > bestN) {
      bestN = n;
      topic = r.topic;
    }
  }

  const search = `${title}\n${short}`;
  const tags = TAG_TOKENS.filter((t) => search.includes(t)).slice(0, 6);

  return { topic, tags };
}
