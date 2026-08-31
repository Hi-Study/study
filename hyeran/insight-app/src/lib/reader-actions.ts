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

// 문장에서 단어장에 담을 만한 핵심 용어(기술용어·전문개념·고유명사)만 선별
export async function extractTerms(text: string): Promise<string[]> {
  const t = text.trim();
  if (t.length < 4) return [];
  try {
    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-flash-lite-latest",
      generationConfig: { responseMimeType: "application/json" },
    });
    const prompt = `다음 문장에서 "단어장에 담아 뜻을 찾아보거나 검색해볼 가치가 있는 핵심 용어"만 골라줘.
규칙: 기술 용어·전문 개념·고유명사 위주. 조사·흔한 일반 단어·동사는 제외. 문장에 나온 표기 그대로. 최대 8개.
출력(JSON만): {"terms":["...","..."]}
문장: ${t.slice(0, 1500)}`;
    const res = await model.generateContent(prompt);
    const j = JSON.parse(res.response.text());
    return Array.isArray(j.terms) ? j.terms.slice(0, 10).map(String).filter((s: string) => s.trim()) : [];
  } catch {
    return [];
  }
}
