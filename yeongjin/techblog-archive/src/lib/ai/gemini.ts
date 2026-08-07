import { GoogleGenerativeAI } from "@google/generative-ai";
import { SUMMARY_PROMPT, parseSummaryJson, type SummaryResult } from "./types";

const MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest";

export async function summarizeWithGemini(text: string): Promise<SummaryResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY가 설정되지 않았습니다");

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: MODEL,
    generationConfig: { responseMimeType: "application/json" },
  });

  const result = await model.generateContent(SUMMARY_PROMPT(text));
  const raw = result.response.text();
  const parsed = parseSummaryJson(raw);

  return { ...parsed, model: `gemini:${MODEL}` } satisfies SummaryResult;
}
