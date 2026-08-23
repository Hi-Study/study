import Groq from "groq-sdk";

// GROQ_API_KEY가 없으면 null을 반환한다 — 호출부가 안내 메시지로 대체한다.
export async function explainWithGroq(selectedText: string): Promise<string | null> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages: [
      {
        role: "system",
        content:
          "너는 기술 블로그의 어려운 문장을 비개발자도 이해할 수 있게 쉬운 말로 풀어주는 도우미야. 2~3문장으로 한국어로 설명해.",
      },
      { role: "user", content: selectedText },
    ],
  });

  return completion.choices[0]?.message?.content ?? null;
}
