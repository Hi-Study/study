/**
 * Gemini 연결 — 모든 단계가 AI 를 부를 때 쓰는 공용 통로.
 * 무료 키 한도(분당 15회 · 하루 500회)에 맞춘 호출 간격·재시도, JSON 스키마 도우미.
 */
import { GoogleGenAI, Type, type Schema } from "@google/genai";

export const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";

let client: GoogleGenAI | null = null;
export function hasGeminiKey(): boolean {
  return !!process.env.GEMINI_API_KEY;
}
function ai(): GoogleGenAI {
  if (!process.env.GEMINI_API_KEY)
    throw new Error("GEMINI_API_KEY 가 없습니다. 프로젝트 폴더의 .env.local 에 GEMINI_API_KEY=... 를 넣어 주세요.");
  client ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  return client;
}

/** 무료 할당량(분당 15회)에 맞춰 호출 간격을 벌린다 */
const MIN_GAP_MS = Number(process.env.GEMINI_MIN_GAP_MS ?? 5000);
let nextSlot = 0;
async function throttle() {
  const now = Date.now();
  const wait = Math.max(0, nextSlot - now);
  nextSlot = Math.max(now, nextSlot) + MIN_GAP_MS;
  if (wait) await new Promise((r) => setTimeout(r, wait));
}

function retryDelayMs(e: unknown, attempt: number): number | null {
  const msg = String((e as Error)?.message ?? e);
  if (/429|RESOURCE_EXHAUSTED/.test(msg)) {
    if (/PerDay/i.test(msg)) return null; // 일일 한도는 기다려도 소용없다
    const s = msg.match(/retry in ([\d.]+)s/i) ?? msg.match(/"retryDelay":"(\d+)s"/);
    return (s ? Number(s[1]) + 2 : 30) * 1000;
  }
  if (/fetch failed|ECONNRESET|ETIMEDOUT|503|500|UNAVAILABLE|overloaded/i.test(msg)) return 5000 * 2 ** attempt;
  if (e instanceof SyntaxError) return 1000; // JSON 이 잘려 온 경우 한 번 더
  return null;
}

export async function json<T>(system: string, user: string, schema?: Schema, maxOutputTokens = 8192): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    await throttle();
    try {
      const res = await ai().models.generateContent({
        model: MODEL,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.3,
          maxOutputTokens,
        },
      });
      const text = (res.text ?? "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      return JSON.parse(text) as T;
    } catch (e) {
      const delay = retryDelayMs(e, attempt);
      if (delay === null || attempt >= 4) throw e;
      nextSlot = Math.max(nextSlot, Date.now() + delay);
    }
  }
}

export const str = (minLength = 1): Schema => ({ type: Type.STRING, minLength: String(minLength) });
export const strArr = (minItems = 1, maxItems?: number): Schema => ({
  type: Type.ARRAY,
  items: str(),
  minItems: String(minItems),
  ...(maxItems ? { maxItems: String(maxItems) } : {}),
});
export const obj = (properties: Record<string, Schema>): Schema => ({
  type: Type.OBJECT,
  properties,
  required: Object.keys(properties),
  propertyOrdering: Object.keys(properties),
});
