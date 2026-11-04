/**
 * Gemini 연결 — 모든 단계가 AI 를 부를 때 쓰는 공용 통로.
 * 무료 키 한도(분당 15회 · 하루 500회)에 맞춘 호출 간격·재시도, JSON 스키마 도우미.
 */
import { GoogleGenAI, Type, type Schema, type ThinkingLevel } from "@google/genai";

export const MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest";
/** 글 상세 요약·개념만 한 단계 위 모델 — lite 는 제품 이름을 용어처럼 설명하고 풀이가 어려웠다(2026-10-21 비교) */
export const DETAIL_MODEL = process.env.GEMINI_DETAIL_MODEL || "gemini-flash-latest";

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
  if (isTransient(e)) return 5000 * 2 ** attempt;
  if (e instanceof SyntaxError) return 1000; // JSON 이 잘려 온 경우 한 번 더
  return null;
}

/** 한도 초과(429) — 분당·하루 한도 모두. 문구가 PerDay 가 아닌 것("You exceeded your current quota …")도 있다 */
export function isQuota(e: unknown): boolean {
  return /\b429\b|RESOURCE_EXHAUSTED|exceeded your current quota/i.test(String((e as Error)?.message ?? e));
}

/**
 * 다시 하면 될 수 있는 오류 — 연결 끊김, 서버 과부하(503), 서버 시간 초과(504 DEADLINE_EXCEEDED), 우리 쪽 제한시간 초과.
 * 같은 글이 한 번은 504(174초), 바로 다음엔 28초에 성공했다(2026-11-04 #2151) — 글이 아니라 서버 상태 탓이다.
 */
export function isTransient(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e);
  return /fetch failed|ECONNRESET|ETIMEDOUT|timed? ?out|abort|503|500|504|UNAVAILABLE|DEADLINE_EXCEEDED|overloaded/i.test(msg);
}

/**
 * opts.thinkingLevel: 생각 단계를 쓰는 모델에서만.
 * opts.timeoutMs: 요청 하나의 제한시간 — 넘으면 끊는다(서버가 붙잡고 있어도 기다리지 않는다).
 * opts.maxRetries: 이 함수 안에서 다시 시도할 횟수(기본 4). 부르는 쪽이 따로 다시 시도하면 0.
 */
export async function json<T>(
  system: string,
  user: string,
  schema?: Schema,
  maxOutputTokens = 8192,
  model = MODEL,
  opts: { thinkingLevel?: ThinkingLevel; timeoutMs?: number; maxRetries?: number } = {},
): Promise<T> {
  const maxRetries = opts.maxRetries ?? 4;
  for (let attempt = 0; ; attempt++) {
    await throttle();
    try {
      const res = await ai().models.generateContent({
        model,
        contents: user,
        config: {
          systemInstruction: system,
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.3,
          maxOutputTokens,
          ...(opts.thinkingLevel ? { thinkingConfig: { thinkingLevel: opts.thinkingLevel } } : {}),
          ...(opts.timeoutMs
            ? { httpOptions: { timeout: opts.timeoutMs }, abortSignal: AbortSignal.timeout(opts.timeoutMs + 5_000) }
            : {}),
        },
      });
      const text = (res.text ?? "").trim().replace(/^```(?:json)?\s*|\s*```$/g, "");
      return JSON.parse(text) as T;
    } catch (e) {
      const delay = retryDelayMs(e, attempt);
      if (delay === null || attempt >= maxRetries) throw e;
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
