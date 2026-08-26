"use server";

// 리더에서 문장 하나를 AI로 한 줄 요약 (하이라이트 4옵션의 'AI 요약')
export async function summarizeSentence(text: string): Promise<string> {
  const t = text.trim();
  if (t.length < 4) return t;
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest" });
    const prompt = `다음 문장을 한국어 한 문장으로 쉽게 풀어 요약해줘. 군더더기 없이 핵심만, 마침표로 끝내기:\n\n${t.slice(0, 1500)}`;
    const res = await model.generateContent(prompt);
    return res.response.text().trim();
  } catch {
    return "요약을 만들지 못했어요. 잠시 후 다시 시도해주세요.";
  }
}
