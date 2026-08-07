import Groq from "groq-sdk";
import { SUMMARY_PROMPT, parseSummaryJson, type SummaryResult } from "./types";

const MODEL = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";

export async function summarizeWithGroq(text: string): Promise<SummaryResult> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY가 설정되지 않았습니다");

  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [{ role: "user", content: SUMMARY_PROMPT(text) }],
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0]?.message?.content ?? "";
  const parsed = parseSummaryJson(raw);

  return { ...parsed, model: `groq:${MODEL}` } satisfies SummaryResult;
}

// 3.8 형광펜 구간 AI 쉬운 설명(v1.1+) 대비 — 짧은 텍스트 실시간 응답용. UI는 MVP 이후 연동 예정.
export async function explainWithGroq(snippet: string): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEY가 설정되지 않았습니다");

  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: MODEL,
    messages: [
      {
        role: "user",
        content: `다음 기술 문장/용어를 비전공자도 이해할 수 있도록 쉬운 한국어로 2~3문장 이내로 풀어 설명해줘. 설명 외 다른 말은 하지 마.\n\n"""${snippet.slice(0, 2000)}"""`,
      },
    ],
  });

  return completion.choices[0]?.message?.content?.trim() ?? "";
}
