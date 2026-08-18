import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";

export type ArticleSummary = {
  problem: string;
  solution: string;
  designerPmTakeaway: string;
};

const responseSchema: Schema = {
  type: SchemaType.OBJECT,
  properties: {
    problem: { type: SchemaType.STRING, description: "무슨 문제를 다뤘는지 (한국어, 2~4문장)" },
    solution: { type: SchemaType.STRING, description: "어떻게 해결했는지 (한국어, 2~4문장)" },
    designerPmTakeaway: {
      type: SchemaType.STRING,
      description: "디자이너·PM 관점에서 무엇을 배울 수 있는지 (한국어, 2~4문장)",
    },
  },
  required: ["problem", "solution", "designerPmTakeaway"],
};

// GEMINI_API_KEY가 없으면 null을 반환한다 — 호출부가 안내 메시지로 대체한다.
export async function summarizeWithGemini(input: {
  title: string;
  description: string | null;
}): Promise<ArticleSummary | null> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-3.6-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema,
    },
  });

  const prompt = `다음 기술 블로그 글을 팀원이 완독 전에 핵심을 빠르게 파악할 수 있도록 한국어로 아래 세 가지 관점에서 요약해줘.
1. 무슨 문제를 다뤘나?
2. 어떻게 해결했나?
3. 디자이너·PM 관점에서 무엇을 배울 수 있나?

제목: ${input.title}
설명: ${input.description ?? "(설명 없음)"}`;

  const result = await model.generateContent(prompt);
  const parsed = JSON.parse(result.response.text());
  return {
    problem: parsed.problem,
    solution: parsed.solution,
    designerPmTakeaway: parsed.designerPmTakeaway,
  };
}
