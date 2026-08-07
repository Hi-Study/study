import type { Category } from "@/generated/prisma/enums";

const KEYWORD_RULES: Array<{ category: Category; keywords: string[] }> = [
  { category: "BACKEND", keywords: ["서버", "api", "db", "데이터베이스", "msa", "백엔드", "트래픽", "아키텍처", "동시성"] },
  { category: "FRONTEND", keywords: ["프론트", "react", "vue", "next.js", "ui", "css", "브라우저", "웹뷰", "렌더링"] },
  { category: "DATA_AI", keywords: ["데이터", "ai", "머신러닝", "llm", "추천", "분석", "모델", "gpt", "임베딩"] },
  { category: "INFRA_DEVOPS", keywords: ["인프라", "devops", "쿠버네티스", "kubernetes", "배포", "ci/cd", "클라우드", "모니터링"] },
  { category: "CULTURE_PROCESS", keywords: ["조직", "문화", "프로세스", "협업", "회고", "온보딩", "애자일"] },
];

// 자동 수집 글의 등록 시점 초기 분류(휴리스틱). AI 요약 완료 후 categoryHint로 갱신됨(3.2, 3.7).
export function guessCategory(title: string, text: string): Category {
  const haystack = `${title} ${text.slice(0, 500)}`.toLowerCase();

  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((kw) => haystack.includes(kw))) {
      return rule.category;
    }
  }

  return "ETC";
}
