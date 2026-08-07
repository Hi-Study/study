export type SummaryResult = {
  lines: string[];
  keywords: string[];
  recommendFor: string | null;
  categoryHint: string | null;
  model: string;
};

const CATEGORY_VALUES = ["BACKEND", "FRONTEND", "DATA_AI", "INFRA_DEVOPS", "CULTURE_PROCESS", "ETC"] as const;

export const SUMMARY_PROMPT = (text: string) => `당신은 국내 기술 블로그 글을 팀 내부용으로 요약하는 어시스턴트입니다.
아래 본문을 읽고 반드시 아래 JSON 스키마로만 응답하세요. 다른 설명은 절대 추가하지 마세요.

{
  "lines": string[],        // 핵심 내용 3~5줄 요약 (한국어, 각 줄은 한 문장)
  "keywords": string[],     // 핵심 키워드/태그 3~6개 (한국어 또는 원어 용어)
  "recommendFor": string,   // "이런 분께 추천" 한 줄 코멘트 (한국어, 없으면 빈 문자열)
  "category": string        // 다음 중 하나만: BACKEND, FRONTEND, DATA_AI, INFRA_DEVOPS, CULTURE_PROCESS, ETC
}

본문:
"""
${text.slice(0, 12000)}
"""`;

export function parseSummaryJson(raw: string): {
  lines: string[];
  keywords: string[];
  recommendFor: string | null;
  categoryHint: string | null;
} {
  const jsonMatch = raw.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("AI 응답에서 JSON을 찾지 못했습니다");

  const parsed = JSON.parse(jsonMatch[0]);
  const lines = Array.isArray(parsed.lines) ? parsed.lines.filter((l: unknown) => typeof l === "string") : [];
  const keywords = Array.isArray(parsed.keywords) ? parsed.keywords.filter((k: unknown) => typeof k === "string") : [];
  const recommendFor = typeof parsed.recommendFor === "string" && parsed.recommendFor.trim() ? parsed.recommendFor : null;
  const categoryHint =
    typeof parsed.category === "string" && (CATEGORY_VALUES as readonly string[]).includes(parsed.category)
      ? parsed.category
      : null;

  if (lines.length === 0) throw new Error("AI 응답에 요약 줄이 없습니다");

  return { lines, keywords, recommendFor, categoryHint };
}
