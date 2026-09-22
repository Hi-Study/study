// summarize — 공유 글/토론을 무료 LLM 으로 요약해 캐시.
//   · { share_id, mode }                  → 공유 본문 요약(모드별) → shares.ai_summaries[mode]
//   · { discussion_id, target:"content", mode } → 토론 주제+여는 글 요약(모드별) → discussions.ai_summaries[mode]
//   · { discussion_id, target:"result" }  → 토론 결과(의견+결론) 요약 → discussions.ai_summary
//   · { word_id }                        → 단어 1단 뜻풀이 → user_words.definition
//   · { word_id, mode:"easy" }           → 단어 2단("더 쉽게") → user_words.easy_definition
//   · { article_id, target:"enrich" }    → 결정 카드 · 질문 · 난이도 · 용어 → articles.*
//   · { article_id, target:"guide" }     → 읽기 요약(핵심 정리·용어·상세) → articles.reading_guide
//   · { article_id, target:"classify" }  → 대분류 판정 3회 + 다수결 → articles.planner_* (+topic)
//   · { target:"draft", question, source } → 내가 밑줄 친 문장으로 **질문의 답 초안** (저장 없음)
//
// mode: plain(원문 요약) | planner(기획자 관점) | explain(쉽게 풀기)
// 배포: supabase functions deploy summarize --use-api
// 키:   supabase secrets set LLM_API_KEY=gsk_...(Groq)
import { corsHeaders, json } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { extractArticle, fetchHtml, stripFooter } from "../_shared/extract.ts";
import { bodyBlocks, cleanBody, numberedBlocks } from "../_shared/blocks.ts";
import {
  CATEGORY_LABEL,
  CLASSIFY_SYS,
  isKorean,
  TOPICS,
  evidenceInBody,
  isMetaSentence,
  majority,
  parseVerdict,
  type Verdict,
} from "../_shared/classify.ts";

type Mode = "plain" | "planner" | "explain" | "insight";

interface Payload {
  share_id?: string;
  article_id?: string;
  discussion_id?: string;
  word_id?: string;
  target?: "content" | "result" | "enrich" | "draft" | "guide" | "classify" | "verify" | "models";
  /** guide 전용 확인 장치 — "groq" | "gemini" 중 하나만 쓴다. 평소엔 주지 않는다. */
  provider?: string;
  /** draft 전용 — 답을 써야 할 질문. */
  question?: string;
  /** draft 전용 — 내가 밑줄 친 문장(+메모) 목록. 본문은 보내지 않는다. */
  source?: string;
  /** 읽는 사람 직무 — insight 모드의 세 번째 항목을 이 관점으로 쓴다. */
  job_role?: string | null;
  /** easy 는 본문 요약 모드가 아니라 **단어 뜻풀이 2단 전용**이라 Mode 에 넣지 않는다. */
  mode?: Mode | "easy";
  debug?: boolean;
  /** classify 전용 — 판정만 하고 **저장하지 않는다**(감사용). */
  dry?: boolean;
  /** debug 전용 — 이만큼의 글자를 보내 실제 크기로 한도를 시험한다. */
  chars?: number;
  /** debug 전용 — 출력 토큰 상한. */
  tokens?: number;
}

// 단어장 뜻풀이 프롬프트 — 문맥(문장)을 참고해 비전공자도 이해할 정의를 만든다.
const WORD_SYS =
  "너는 IT·기획·개발 용어를 아주 쉽게 풀어주는 한국어 사전이다. 주어진 단어를, 함께 준 문맥 문장이 있으면 그 " +
  "쓰임에 맞춰, 전문 지식이 없는 사람도 이해하도록 2~3문장으로 설명해라. 첫 문장은 한 줄 정의, 이어서 왜 쓰는지나 " +
  "쉬운 예시를 붙여라. 단어 자체를 그대로 반복하지 말고 뜻만 풀어 써라. 존댓말, 불릿 없이 문단으로.";

// 모드별 시스템 프롬프트(본문/글 요약 공통).
const CONTENT_SYS: Record<Mode, string> = {
  plain:
    "너는 글의 핵심을 뽑는 한국어 요약가다. 원문 문장을 그대로 옮기지 말고, 글의 핵심 주장과 " +
    "근거만 골라 3~5문장으로 압축해서 새로 써라. 원문보다 반드시 짧아야 한다. " +
    "도입부 인사말·메뉴·광고·저작권 문구는 무시. 존댓말, 불릿 없이 문단으로.",
  planner:
    "너는 서비스 기획자를 돕는 한국어 요약가다. 이 글에서 '기획자가 주목하면 좋은' 관점·인사이트·" +
    "자기 업무(기획/기획서/의사결정)에 적용할 점을 3~5가지로 뽑아 정리해라. 각 항목은 한두 문장으로, " +
    "왜 중요한지가 드러나게. 존댓말. 각 항목 앞에 '· ' 를 붙여라.",
  explain:
    "너는 어려운 글을 '중학생도 이해할 만큼' 아주 쉽게 풀어주는 한국어 설명가다. 반드시 지켜라: " +
    "(1) 개발·기술·전문 용어가 나오면 그대로 두지 말고 쉬운 말로 바꾸거나 괄호로 뜻을 풀어라. " +
    "(2) 짧은 문장과 일상적인 비유를 적극 써라. " +
    "(3) 전문 지식이 전혀 없어도 '무슨 얘기이고 왜 중요한지'가 이해되게 써라. " +
    "(4) 원문 문장을 그대로 옮기지 말고 네 말로 다시 설명하라. 4~6문장, 존댓말.",
  insight:
    "너는 디자이너·PM(기획자)를 돕는 한국어 분석가다. 이 글을 읽고 반드시 정확히 세 부분으로 나눠 정리해라. " +
    "형식은 절대 어기지 마라: 각 부분은 반드시 '### ' 로 시작하는 제목 줄로 시작하고, 그 다음 줄에 2~3문장 본문을 쓴다. " +
    "제목은 아래 세 개를 글자 그대로, 순서대로 사용해라(추가·삭제·변형 금지):\n" +
    "### 무슨 문제를 다뤘나\n### 어떻게 해결했나\n### 디자이너·PM 관점에서 배울 점\n" +
    "세 번째 부분은 '이 글에서 디자이너나 PM이 자기 업무(기획·설계·의사결정)에 실제로 적용할 만한 배움'을 구체적으로 써라. " +
    "원문 문장을 그대로 옮기지 말고 네 말로 정리하라. 존댓말, 불릿 없이 문단으로.",
};

const RESULT_SYS =
  "너는 토론을 정리하는 한국어 요약가다. 주제, 주요 의견들의 쟁점, 그리고 (있다면) 방장이 고정한 결론을 " +
  "중심으로 4~6문장으로 정리해라. 어떤 의견들이 오갔고 무엇으로 모였는지 드러나게. 존댓말, 문단으로.";

/**
 * LLM 제공자 체인 — 앞에서부터 시도해 첫 성공을 쓴다.
 *
 * **왜 둘인가.** Groq 무료 티어는 하루 200,000토큰이다. 가이드 한 건이 7,000토큰이라
 * 하루 25~28건이면 끝난다. 프롬프트를 고치며 같은 글을 대여섯 번 다시 만들면
 * 그 하루치가 오후에 사라진다(실제로 매일 그랬다). 그때 **다음 제공자로 넘어가면**
 * 하루가 거기서 끝나지 않는다.
 *
 * Gemini 는 **OpenAI 호환 엔드포인트**를 제공해서 요청·응답 모양이 같다 —
 * 주소와 키, 모델 이름만 바꾸면 이 코드가 그대로 돈다.
 *
 * ⚠️ 키가 없는 제공자는 **조용히 건너뛴다.** GEMINI_API_KEY 를 안 넣으면 예전처럼 Groq 만 쓴다.
 *    (넣으려면: supabase secrets set GEMINI_API_KEY=...)
 * ⚠️ `reasoning_effort` 는 gpt-oss 계열 전용이라 Groq 에만 보낸다. Gemini 는 그 필드를 모른다.
 */
interface LlmProvider {
  name: string;
  url: string;
  envKey: string;
  models: string[];
  /** gpt-oss 는 추론형이라 생각 토큰을 줄여야 한다(아래 callLlm 주석 참고). */
  reasoningEffort?: boolean;
}

const LLM_PROVIDERS: LlmProvider[] = [
  {
    name: "groq",
    url: "https://api.groq.com/openai/v1/chat/completions",
    envKey: "LLM_API_KEY",
    // 이 키로 실측 확인: gpt-oss 계열만 접근 가능(llama 계열은 model_not_found).
    models: ["openai/gpt-oss-120b", "openai/gpt-oss-20b"],
    reasoningEffort: true,
  },
  {
    name: "gemini",
    url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
    envKey: "GEMINI_API_KEY",
    /**
     * ⚠️ **별칭을 쓴다.** 처음에 `gemini-2.5-flash` 를 박아 넣었더니 404 였다 —
     *    목록에는 있는데 "no longer available to new users" 라 이 키로는 못 쓴다.
     *    구글이 모델을 조용히 폐기·제한하므로 버전을 박으면 어느 날 체인이 말을 안 듣는다.
     *    `-latest` 별칭은 그때그때 현행 모델을 가리킨다.
     *    쓸 수 있는 이름은 `{ "target": "models" }` 로 언제든 다시 확인할 수 있다(토큰 0).
     */
    /**
     * flash 둘만 두었더니 **연속으로 503**("high demand")이 났다 — 무료 티어에서 flash 는
     * 수요가 몰린다. 그래서 **경량(lite) 모델을 뒤에 붙인다.** 품질은 조금 낮지만,
     * 백업은 "답을 주는 것"이 먼저다. 답을 못 받으면 요약이 아예 안 생긴다.
     */
    /**
     * 순서는 **실측**으로 정했다(`{ "debug": true, "tokens": 40 }` — 토큰 거의 안 듦):
     *   gemini-flash-latest      OK
     *   gemini-flash-lite-latest OK
     *   gemini-3.5-flash         실제 호출에서 503 이 잦았다 — 맨 뒤로
     *   gemini-2.5-flash-lite    404(이 키로는 못 씀) — 뺐다
     * 막히면 그 debug 호출로 다시 재서 순서를 고친다. 이름을 추측하지 않는다.
     */
    models: ["gemini-flash-latest", "gemini-flash-lite-latest", "gemini-3.5-flash"],
  },
];

let lastLlmError: string | null = null;
/** 마지막으로 **답을 준** 제공자/모델. 제공자가 둘이 되면서, 실패를 봐도
 *  어느 쪽이 쓴 결과인지 몰라 원인을 못 가렸다(Groq 인가 Gemini 인가). */
let lastLlmUsed: string | null = null;
/**
 * 마지막 응답의 한도 헤더 — "얼마 남았나"를 물을 때 유일한 근거다.
 * 예전엔 이 헤더를 버려서, 남은 양을 **429 가 날 때까지 알 수 없었다.**
 * ⚠️ Groq 의 `x-ratelimit-*-tokens` 는 **분당(TPM)** 값이다.
 *    하루치(TPD)는 헤더로 안 오고 429 본문에만 나온다 — 그래서 그때 본문을 같이 남긴다.
 */
let lastLlmLimits: Record<string, string> = {};
/**
 * 이번 호출에서 **실패한 시도들**. 제공자가 둘이 되면서 "왜 저쪽이 아니라 이쪽이 답했나"를
 * 알 길이 없었다. CLI 에 함수 로그 명령이 없어 콘솔만으로는 확인이 안 된다 —
 * 그래서 응답에 실어 보낸다. 성공하면 비어 있다.
 */
let llmTried: string[] = [];
/** 용어 게이트 통계 — 모델이 몇 개를 냈고 그중 몇 개가 본문 대조에서 떨어졌나. */
let termsProposed = 0;
let termsDropped: string[] = [];

async function callLlm(
  provider: LlmProvider,
  text: string,
  system: string,
  model: string,
  maxTokens = 900,
): Promise<string | null> {
  const apiKey = Deno.env.get(provider.envKey);
  if (!apiKey) {
    lastLlmError = `NO_API_KEY(${provider.envKey})`;
    return null;
  }
  try {
    const res = await fetch(provider.url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        /**
         * ⚠️ gpt-oss 는 **추론형 모델**이다. 답을 내기 전에 속으로 생각한 토큰이
         *    max_tokens 에서 먼저 깎여서, 한도가 빠듯하면 생각만 하다 끝나고
         *    content 가 **빈 문자열**로 온다(실측: classify 500토큰에서 거의 전부 EMPTY_CONTENT).
         *    reasoning_effort 를 낮춰 생각을 짧게 시키고, 한도도 넉넉히 준다.
         */
        ...(provider.reasoningEffort ? { reasoning_effort: "low" } : {}),
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: text.slice(0, 24000) },
        ],
      }),
    });
    if (!res.ok) {
      lastLlmError = `[${provider.name}/${model}] HTTP ${res.status}: ${(await res.text()).slice(0, 400)}`;
      return null;
    }
    for (const k of [
      "x-ratelimit-limit-tokens",
      "x-ratelimit-remaining-tokens",
      "x-ratelimit-reset-tokens",
      "x-ratelimit-limit-requests",
      "x-ratelimit-remaining-requests",
    ]) {
      const v = res.headers.get(k);
      if (v) lastLlmLimits[`${provider.name}:${k.replace("x-ratelimit-", "")}`] = v;
    }
    const data = await res.json();
    const msg = data?.choices?.[0]?.message;
    const out = msg?.content?.trim() ?? null;
    if (out) lastLlmUsed = `${provider.name}/${model}`;
    if (!out) {
      // 왜 비었는지 남긴다 — 한도 때문인지(length) 다른 이유인지 구분돼야 고칠 수 있다.
      const why = data?.choices?.[0]?.finish_reason ?? "?";
      lastLlmError = `[${provider.name}/${model}] EMPTY_CONTENT (finish=${why})`;
    }
    return out;
  } catch (e) {
    lastLlmError = `[${provider.name}/${model}] EXC: ${e instanceof Error ? e.message : String(e)}`;
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * 429(레이트리밋) 응답은 "Please try again in 17.3025s" 처럼 **얼마나 기다려야 하는지**를
 * 알려준다. 그 값을 그대로 쓴다. 고정 1.5초 백오프로는 어림도 없었다
 * (Groq 무료 티어 TPM 8,000 — 긴 본문 한 건이 5,000토큰이라 분당 1건 남짓).
 */
function retryAfterMs(err: string | null): number {
  const e = err ?? "";
  const m = e.match(/try again in ([\d.]+)s/i);
  if (m) return Math.min(Math.ceil(parseFloat(m[1]) * 1000) + 1000, 30000); // 여유 1초, 최대 30초
  /**
   * 503 "high demand" — Gemini 무료 티어가 붐빌 때 나온다. 얼마나 기다리라는 말이 없어서
   * 예전엔 **재시도 없이 바로 포기**했다(실측: 같은 글이 연속 두 번 503 으로 실패).
   * 잠깐이면 풀리는 종류라 짧게 쉬고 한 번 더 물어본다.
   */
  if (/503/.test(e) || /high demand|overloaded|UNAVAILABLE/i.test(e)) return 4000;
  return 0;
}

/**
 * 요청 하나가 **분당 한도보다 큰지** 본다.
 *
 * Groq 의 429 는 두 종류다:
 *   ① "지금은 꽉 찼으니 N초 뒤에" — 기다리면 풀린다
 *   ② "요청한 양(Requested)이 한도(Limit)보다 크다" — **기다려도 영원히 안 풀린다**
 * ②를 기다림으로 대응하면 끝없이 재시도만 한다. 그때는 **입력을 줄여 다시** 물어야 한다.
 */
function overBudget(err: string | null): boolean {
  const m = (err ?? "").match(/Limit\s+(\d+)[^]*?Requested\s+(\d+)/i);
  if (!m) return false;
  return Number(m[2]) >= Number(m[1]);
}

/**
 * @param only 특정 제공자만 쓴다("groq" | "gemini"). **확인용**이다 —
 *   폴백은 평소 Groq 이 성공하면 안 돌아서, 제미나이 쪽 문제를 재현하려면
 *   체인 순서를 뒤집고 두 번 배포해야 했다(그러다 배열을 깨뜨린 적도 있다).
 *   지정할 수 있으면 배포 없이 그 자리에서 확인된다.
 */
async function llmSummarize(
  text: string,
  system: string,
  maxTokens = 900,
  only?: string,
): Promise<string | null> {
  // 제공자 → 모델 순으로 훑고, 레이트리밋이면 응답이 알려준 만큼 기다렸다 다시 시도한다.
  llmTried = [];
  let input = text;
  let budget = maxTokens;
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const provider of LLM_PROVIDERS) {
      if (only && provider.name !== only) continue;
      // 키를 안 넣은 제공자는 건너뛴다 — 없는 걸 시도해 봐야 로그만 더러워진다.
      if (!Deno.env.get(provider.envKey)) continue;
      for (const model of provider.models) {
        const out = await callLlm(provider, input, system, model, budget);
        if (out) return out;
        llmTried.push((lastLlmError ?? "?").slice(0, 160));
        console.error("[summarize] model fail:", lastLlmError);
      }
    }
    // 한도보다 큰 요청이면 기다려도 소용없다 — 절반으로 줄여 다시 묻는다.
    if (overBudget(lastLlmError)) {
      input = input.slice(0, Math.floor(input.length / 2));
      budget = Math.max(600, Math.floor(budget / 2));
      console.error(`[summarize] 요청이 한도 초과 — 입력 ${input.length}자 / 출력 ${budget}토큰으로 축소`);
      continue;
    }
    const wait = retryAfterMs(lastLlmError);
    if (wait > 0 && attempt < 2) {
      await sleep(wait);
      continue;
    }
    break;
  }
  return null;
}

// 공유 글 본문 확보(article_text → 라이브 추출 → body → og_description 순).
async function shareSourceText(shareId: string): Promise<{ text: string; title: string; fallback: string }> {
  const supabase = serviceClient();
  const { data: share, error } = await supabase
    .from("shares")
    .select("id, kind, title, url, note, body, og_description, article_text")
    .eq("id", shareId)
    .single();
  if (error || !share) throw new Error("공유 글을 찾을 수 없음");

  let text: string = stripFooter(share.article_text ?? "");
  if (!text && share.kind === "link" && share.url) {
    try {
      const extracted = extractArticle(await fetchHtml(share.url), share.url);
      text = extracted.text ?? "";
      if (text) await supabase.from("shares").update({ article_text: text }).eq("id", shareId);
    } catch {
      text = "";
    }
  }
  if (!text) text = share.body ?? "";
  if (!text) text = share.og_description ?? "";
  const fallback =
    [share.title, share.note ?? share.og_description].filter(Boolean).join(" — ") || share.title;
  return { text, title: share.title, fallback };
}

async function summarizeShare(shareId: string, mode: Mode): Promise<string> {
  const supabase = serviceClient();
  const { text, fallback } = await shareSourceText(shareId);
  const summary = (text ? await llmSummarize(text, CONTENT_SYS[mode]) : null) ?? fallback;

  // ai_summaries[mode] 병합 저장(다른 모드 캐시 보존).
  const { data: cur } = await supabase.from("shares").select("ai_summaries").eq("id", shareId).single();
  const merged = { ...(cur?.ai_summaries ?? {}), [mode]: summary };
  await supabase.from("shares").update({ ai_summaries: merged, ai_summary: summary }).eq("id", shareId);
  return summary;
}

// 직무별 "배울 점" 제목 — 앱의 lib/summary.ts ROLE_INSIGHT_TITLE 과 **문자열이 같아야** 파싱된다.
const ROLE_INSIGHT_TITLE: Record<string, string> = {
  planner: "기획자 관점에서 배울 점",
  designer: "디자이너 관점에서 배울 점",
  marketer: "마케터 관점에서 배울 점",
  dev: "개발자 관점에서 배울 점",
  data: "데이터 관점에서 배울 점",
  other: "실무에 적용할 점",
};
const ROLE_INSIGHT_FOCUS: Record<string, string> = {
  planner: "기획자가 자기 업무(문제 정의·의사결정·지표)에 적용할 만한 배움",
  designer: "디자이너가 자기 업무(화면·흐름·사용자 경험)에 적용할 만한 배움",
  marketer: "마케터가 자기 업무(획득·전환·리텐션·메시지)에 적용할 만한 배움",
  dev: "개발자가 자기 업무(설계·구현·운영)에 적용할 만한 배움",
  data: "데이터 직군이 자기 업무(지표 설계·분석·실험)에 적용할 만한 배움",
  other: "실무에 바로 적용할 만한 배움",
};

/** insight 프롬프트의 세 번째 제목/초점만 직무에 맞게 바꾼다(앞 두 제목은 고정 — 파싱 기준). */
function insightSysFor(jobRole: string | null | undefined): string {
  const base = CONTENT_SYS.insight;
  const title = ROLE_INSIGHT_TITLE[jobRole ?? ""];
  if (!title) return base;
  const focus = ROLE_INSIGHT_FOCUS[jobRole ?? ""] ?? ROLE_INSIGHT_FOCUS.other;
  return base
    .replaceAll("디자이너·PM 관점에서 배울 점", title)
    .replace(
      "'이 글에서 디자이너나 PM이 자기 업무(기획·설계·의사결정)에 실제로 적용할 만한 배움'",
      `'${focus}'`,
    );
}

// distill 아티클 요약(모드별) → articles.ai_summaries[키] 캐시.
//   insight 는 직무별로 결과가 달라지므로 키를 `insight_<직무>` 로 분리한다.
async function summarizeArticle(
  articleId: string,
  mode: Mode,
  jobRole?: string | null,
): Promise<string> {
  const supabase = serviceClient();
  const { data: art, error } = await supabase
    .from("articles")
    .select("id, title, body, url, summary, ai_summaries")
    .eq("id", articleId)
    .single();
  if (error || !art) throw new Error("아티클을 찾을 수 없음");

  let text: string = stripFooter(art.body ?? "");
  if (!text && art.url) {
    try {
      text = extractArticle(await fetchHtml(art.url), art.url).text ?? "";
    } catch {
      text = "";
    }
  }
  const fallback = [art.title, art.summary].filter(Boolean).join(" — ") || art.title;
  const sys = mode === "insight" ? insightSysFor(jobRole) : CONTENT_SYS[mode];
  const llm = text ? await llmSummarize(text, sys) : null;

  // 캐시 키: insight 만 직무별로 분리(다른 모드는 종전 그대로).
  const cacheKey = mode === "insight" && jobRole ? `insight_${jobRole}` : mode;

  // LLM 성공했을 때만 캐시 저장(폴백/제목은 캐시하지 않음 → 다음에 재시도해 제대로 채움).
  if (llm) {
    const merged = { ...(art.ai_summaries ?? {}), [cacheKey]: llm };
    await supabase.from("articles").update({ ai_summaries: merged }).eq("id", articleId);
  }
  return llm ?? fallback;
}

// distill 단어장 뜻풀이 → user_words.definition 저장. 실패 시 저장하지 않음(재시도 가능).
async function defineWord(wordId: string): Promise<string | null> {
  const supabase = serviceClient();
  const { data: w, error } = await supabase
    .from("user_words")
    .select("id, term, context")
    .eq("id", wordId)
    .single();
  if (error || !w) throw new Error("단어를 찾을 수 없음");

  const prompt = w.context ? `단어: ${w.term}\n문맥 문장: ${w.context}` : `단어: ${w.term}`;
  const definition = await llmSummarize(prompt, WORD_SYS);
  if (!definition) return null; // LLM 실패 → definition 그대로 null 유지(앱에서 재시도)
  await supabase.from("user_words").update({ definition }).eq("id", wordId);
  return definition;
}

// 단어장 2단("더 쉽게") — 그 사람 **직무 언어 + 비유**로 다시 쓴다.
//   단어를 눌렀다는 것 자체가 "이 영역에 약하다"는 신호라, 1단으로 부족했다고 보고 눈높이를 낮춘다.
//   ⚠️ 개발자 전용이 아니다 — 개발자가 마케팅 용어를 누르면 대칭으로 작동한다.
const ROLE_WORDS: Record<string, string> = {
  planner: "서비스 기획자(지표·사용자 영향·의사결정 관점)",
  designer: "프로덕트 디자이너(화면·사용자 경험 관점)",
  marketer: "마케터(획득·전환·리텐션 관점)",
  dev: "개발자(구현·시스템 관점)",
  data: "데이터 분석가(지표·데이터 흐름 관점)",
  other: "비전공자",
};

async function explainWordEasier(wordId: string): Promise<string | null> {
  const supabase = serviceClient();
  const { data: w, error } = await supabase
    .from("user_words")
    .select("id, term, context, definition, domain, job_role")
    .eq("id", wordId)
    .single();
  if (error || !w) throw new Error("단어를 찾을 수 없음");

  const who = ROLE_WORDS[w.job_role ?? "other"] ?? ROLE_WORDS.other;
  const sys =
    `너는 어려운 용어를 ${who}의 언어로 다시 설명하는 한국어 도우미다. ` +
    "이 사람은 이미 한 줄 정의를 봤지만 이해하지 못했다. 그러니 정의를 반복하지 말고, " +
    "일상적인 비유 하나를 들어 2~3문장으로 다시 설명해라. 그리고 이 사람의 일에서 왜 알아둘 " +
    "가치가 있는지 한 문장을 덧붙여라. 전문 용어를 새로 끌어들이지 마라. 존댓말, 불릿 없이 문단으로.";

  const parts = [`단어: ${w.term}`];
  if (w.domain) parts.push(`영역: ${w.domain}`);
  if (w.definition) parts.push(`이미 본 설명(반복 금지): ${w.definition}`);
  if (w.context) parts.push(`문맥 문장: ${w.context}`);

  const easy = await llmSummarize(parts.join("\n"), sys);
  if (!easy) return null;
  await supabase.from("user_words").update({ easy_definition: easy }).eq("id", wordId);
  return easy;
}

// ── 결정 카드 · 질문 · 난이도 · 용어 (수집 후 1회 배치) ─────────────────────────
//
// 기획자·디자이너·마케터가 기술블로그에서 얻고 싶은 건 구현 방법이 아니라 **판단**이다.
// 그래서 글을 {문제 · 제약 · 선택 · 버린 대안 · 결과}로 다시 쓴다.
//
// ⚠️ 없는 걸 지어내지 않는 게 이 기능의 전부다. 본문에 트레이드오프 서술이 없는 글
//    (회고 · 문화 · 인터뷰)은 decision 을 null 로 두고, 그러면 질문도 안 만들어진다.
//    화면은 그런 글에 결정 카드/질문 대신 원탭 스탬프만 보여준다.
/**
 * metric 이 **고른 것의 성과인지** 본다. 아니면 빈 문자열로 만든다.
 *
 * 실측 사고: chosen="PolicyGuard 프레임워크" 인데 metric 으로
 * "Presidio Effective Block Rate 62.2%" 가 들어왔다. 62.2% 는 PolicyGuard 의 성과가 아니라
 * **비교 대상의 한계**였는데("Presidio 의 EBR 은 62.2%에 그쳤으며"), 앱이 그걸
 * "PolicyGuard 를 골랐더니 62.2%" 로 이어 붙여 사실이 뒤집힌 질문을 만들었다.
 * 프롬프트로 금지하는 것만으로는 부족해서 여기서 한 번 더 막는다.
 */
function metricOfChoice(chosen: string, metric: string): string {
  const m = metric.trim();
  if (!m) return "";
  const first = m.split(/[\s·,(]/)[0] ?? "";
  // ⚠ 전부 대문자인 약어(CPU·RPS·LLM·JSON)는 제품명이 아니다 — 멀짱한 지표까지 버려졌다(실측).
  //   제품명은 Presidio·PolicyGuard 처럼 첫 글자만 대문자다.
  if (!/^[A-Z][a-z][A-Za-z0-9.-]*$/.test(first)) return m;
  const norm = (v: string) => v.toLowerCase().replace(/[\s·-]/g, "");
  return norm(chosen).includes(norm(first)) ? m : "";
}

const ENRICH_SYS =
  "너는 기술·기획 아티클을 읽고 구조화하는 한국어 분석기다. 반드시 아래 JSON 하나만 출력해라" +
  "(설명·코드펜스 금지).\n" +
  '{"decision":{"problem":"","constraint":"","chosen":"","rejected":"","metric":""},' +
  '"questions":{"insight":"","apply":"","hypothesis":""},' +
  '"level":"easy|terms|code","terms":[{"term":"","plain":"","why":"","domain":""}]}\n' +
  "규칙:\n" +
  "1) decision 은 **본문에 실제로 쓰인 내용만** 채운다. 특히 rejected(버린 대안)는 글이 " +
  "명시적으로 'A 대신 B' 또는 'A는 ~해서 안 썼다'라고 말한 경우에만 채우고, 아니면 빈 문자열로 둬라. " +
  "추측해서 채우지 마라. 회고·문화·인터뷰 글이면 decision 의 모든 값을 빈 문자열로 둬라.\n" +
  "2) metric 은 **chosen(고른 것)이 만들어 낸 결과**여야 한다. 숫자와 단위가 함께 있어야 한다" +
  "(예: '실패율 2.1%→0.4%', '응답 300ms 단축').\n" +
  "   ⚠️ **비교 대상이나 기존 방식의 숫자를 쓰지 마라.** 'A 도구는 62.2%에 그쳤다' 처럼 " +
  "다른 것의 한계를 보여주는 숫자는 metric 이 아니다 — 그걸 넣으면 " +
  "'우리가 A를 골랐더니 62.2%' 라는 **사실이 뒤집힌 문장**이 만들어진다(실측 사고).\n" +
  "   숫자만 덩그러니 있거나 결과가 아니면 빈 문자열로 둬라.\n" +
  "2-1) chosen 과 rejected 는 **서로 비교 가능한 짧은 명사구**(각 20자 이내)로 쓴다. " +
  "예: chosen='단일 테이블', rejected='테이블 분리'. " +
  "'~하지 않음', '~를 만들지 않음' 같은 부정 서술이나 문장은 쓰지 마라. " +
  "둘이 같은 대상을 가리키게 되면 rejected 를 빈 문자열로 둬라.\n" +
  "3) level: easy=배경지식 없이 읽힘, terms=도메인 용어가 나옴, code=코드/아키텍처 상세가 있음.\n" +
  "4) terms 는 비전공자가 막힐 용어만 **최대 4개**. plain 은 한 문장, why 는 반 문장으로 짧게. " +
  "domain 은 dev|infra|data|design|marketing|product|biz 중 하나.\n" +
  "5) questions 는 이 글을 다 읽은 사람이 **답을 쓸 수 있는 질문** 3개다.\n" +
  "   · insight: 이 글이 내린 **판단·트레이드오프**를 파고드는 질문.\n" +
  "   · apply: 읽는 사람의 **자기 일**로 옮기게 하는 질문. '우리'가 들어가야 한다.\n" +
  "   · hypothesis: 이들이 **왜 그 방법이면 문제가 풀린다고 봤는지**, 그 가설의 근거를 " +
  "추론하게 하는 질문.\n" +
  "     ⚠️ **원인을 묻지 마라.** 원인·문제는 요약이 이미 말해 준다 — 되물으면 답이 " +
  "본문 베끼기가 된다.\n" +
  "     물어야 할 건 원인과 해법 **사이의 연결**이다: 그 방법이면 그 원인이 해소된다고 " +
  "본 근거.\n" +
  "     좋음: '왜 즉시 재시도로는 안 되고 지연 재시도로 실패가 준다고 봤을까요?'\n" +
  "     나쁨: '결제 실패의 원인은 무엇이었나요?' (요약에 이미 있다)\n" +
  "   세 질문 모두 아래를 지켜라.\n" +
  "   (a) 이 글에만 해당되는 **고유명사·기술명·수치**를 최소 하나 그대로 넣는다.\n" +
  "       좋음: 'Lynx를 웹뷰 대신 고른 기준이 우리 앱에도 그대로 적용될까요?'\n" +
  "       나쁨: '핵심은 무엇인가요?' '어떤 점이 인상 깊었나요?' (어느 글에나 붙는다)\n" +
  "   (b) 25~60자. 물음표로 끝낸다.\n" +
  "   (c) 예/아니오로 끝나는 질문 금지. '왜''무엇을''어디부터'로 답을 끌어내라.\n" +
  "   (d) '이 글', '저자', '필자', '본문'이라는 말을 쓰지 마라. 읽은 사람은 이미 글을 안다.\n" +
  "   (e) 본문에 없는 사실을 전제로 묻지 마라. 확신이 없으면 빈 문자열로 둬라.\n" +
  "6) 모든 값은 한국어. 문장은 짧게.";

/**
 * LLM 이 만든 질문이 **쓸 만한지** 본다. 통과 못 하면 버리고 앱이 템플릿으로 폴백한다.
 *
 * ⚠️ 자유 생성을 그냥 믿으면 "핵심은 무엇인가요?" 같은, 어느 글에나 붙어서 아무도
 *    답하지 않는 질문이 쌓인다. 게이트의 핵심은 마지막 줄 — **이 글에만 있는 단어**가
 *    들어 있느냐다. 제목·결정 카드에서 뽑은 토큰과 겹치는지로 확인한다.
 */
const GENERIC_Q =
  /이 글|본문|저자|필자|핵심은|인상 ?깊|무엇을 배웠|어떤 점이|느낀 점|소감|정리해 ?보|요약해/;

/**
 * 가설 질문 전용 금지 — **원인을 되묻는 질문**을 걸러낸다.
 * 원인은 요약(한눈에 · 더 들어가 볼까요)이 이미 말해 준다. 그걸 다시 물으면 답이
 * 본문 베끼기가 되고, 가설을 세우는 연습이 되지 않는다.
 */
const CAUSE_Q = /원인(은|이|을)? ?무엇|무엇이 원인|왜 (이런|그런) 문제|어떤 문제가 (있었|생겼)/;

function usableQuestion(q: string, specifics: string[]): string | null {
  const t = q.trim();
  if (t.length < 20 || t.length > 80) return null;
  if (!t.endsWith("?")) return null;
  if (GENERIC_Q.test(t)) return null;
  const hit = specifics.some((w) => t.includes(w));
  return hit ? t : null;
}

/** 제목·결정 카드에서 "이 글에만 있는 단어" 후보를 뽑는다(2자 이상 토큰). */
function specificTokens(title: string, d: Record<string, string>): string[] {
  const raw = [title, d.chosen, d.rejected, d.problem, d.metric].join(" ");
  return raw
    .split(/[^0-9A-Za-z가-힣%.]+/)
    .map((w) => w.replace(/(을|를|이|가|은|는|의|로|과|와|에서)$/, "").trim())
    .filter((w) => w.length >= 2);
}

// LLM 이 코드펜스를 붙이거나 앞뒤에 말을 덧붙여도 JSON 만 건져낸다.
/**
 * 잘린 JSON 을 **살려낸다.**
 *
 * 토큰 상한에 걸리면 모델의 출력이 문장 한가운데서 끊긴다. 그때 통째로 버리면
 * 앞쪽 항목까지 다 잃는다 — 실제로 "JSON 파싱 실패"의 대부분이 이 경우였다.
 * 그래서 **마지막으로 온전했던 자리**까지 되감고 열린 괄호를 닫아준다.
 *
 * 되감는 기준: 문자열 안이 아니면서 값 하나가 막 끝난 자리(`"` `}` `]` 또는 숫자·불리언 끝).
 * 거기까지 자르면 그 뒤의 반쪽짜리 항목만 잃고 앞은 전부 살아남는다.
 */
function repairJson(t: string): string {
  const stack: string[] = [];
  let inStr = false;
  let esc = false;
  let safe = -1; // 잘라도 되는 마지막 위치(이 인덱스까지 포함)

  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === "\\") esc = true;
      else if (ch === '"') {
        inStr = false;
        safe = i;
      }
      continue;
    }
    if (ch === '"') {
      inStr = true;
      continue;
    }
    if (ch === "{" || ch === "[") stack.push(ch);
    else if (ch === "}" || ch === "]") {
      stack.pop();
      safe = i;
    } else if (/[\d\w]/.test(ch)) safe = i; // 숫자·true/false/null 의 끝일 수 있다
  }

  if (stack.length === 0 && !inStr) return t;

  let out = t.slice(0, safe + 1).replace(/,\s*$/, "");
  for (let i = stack.length - 1; i >= 0; i--) out += stack[i] === "{" ? "}" : "]";
  return out;
}

function parseJsonLoose(raw: string): Record<string, unknown> | null {
  const t = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = t.indexOf("{");
  if (start < 0) return null;
  const body = t.slice(start);

  const end = body.lastIndexOf("}");
  if (end > 0) {
    try {
      return JSON.parse(body.slice(0, end + 1)) as Record<string, unknown>;
    } catch {
      // 아래 복구로 넘어간다
    }
  }
  try {
    return JSON.parse(repairJson(body)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** 한국어 기술글 기준 약 600자/분. */
function readMinutes(body: string): number | null {
  const n = body.replace(/\s+/g, "").length;
  return n > 0 ? Math.max(1, Math.round(n / 600)) : null;
}

async function enrichArticle(articleId: string) {
  const supabase = serviceClient();
  const { data: art, error } = await supabase
    .from("articles")
    .select("id, title, body, url, blog:blogs(name)")
    .eq("id", articleId)
    .single();
  if (error || !art) throw new Error("아티클을 찾을 수 없음");

  let body = (art.body ?? "").trim();
  if (!body && art.url) {
    try {
      const html = await fetchHtml(art.url);
      body = stripFooter(extractArticle(html, art.url).text ?? "");
    } catch {
      body = "";
    }
  }
  if (!body) return { ok: false, reason: "본문 없음" };

  // 입력은 3,000자로 줄인다 — 결정·난이도·용어는 앞부분으로 대부분 판단되고,
  // 무료 티어 TPM(8,000) 안에 들어와야 배치가 굴러간다.
  // 출력은 1,800 토큰 — 900·1,400 에서 JSON 이 중간에 잘려 파싱이 실패했다.
  const raw = await llmSummarize(
    `제목: ${art.title}\n\n${body.slice(0, 3000)}`,
    ENRICH_SYS,
    1800,
  );
  // ⚠️ 실패 원인을 뭉개지 말 것 — 호출 실패(레이트리밋 등)와 JSON 파싱 실패는 대응이 다르다.
  if (!raw) return { ok: false, reason: "LLM 호출 실패", detail: lastLlmError };
  const parsed = parseJsonLoose(raw);
  if (!parsed) {
    return { ok: false, reason: "JSON 파싱 실패", sample: raw.slice(0, 300) };
  }

  const d = (parsed.decision ?? {}) as Record<string, unknown>;
  const decision = {
    problem: str(d.problem),
    constraint: str(d.constraint),
    chosen: str(d.chosen),
    rejected: str(d.rejected),
    // ⚠️ 프롬프트만으로는 안 막힌다 — 비교 대상의 숫자가 metric 으로 들어온 적이 있다.
    //    고른 것과 다른 이름으로 시작하는 숫자는 버린다(위 규칙 2 주석 참고).
    metric: metricOfChoice(str(d.chosen), str(d.metric)),
  };
  // 문제와 선택이 둘 다 있어야 카드를 만든다(반쪽짜리는 저장하지 않는다).
  const hasDecision = decision.problem !== "" && decision.chosen !== "";

  // 질문은 **자유 생성이 아니라 조립**이다. 선택/버린 대안이 둘 다 있을 때만 만들어진다.
  //   자유 생성은 "이 글의 핵심은?" 같은 어느 글에나 붙는 질문을 낳아서 아무도 답하지 않는다.
  const blogName = (art as { blog?: { name?: string } | null }).blog?.name ?? "";

  /**
   * 두 선택지가 **비교 가능한 대안 한 쌍**인지 본다. 아니면 질문을 만들지 않는다.
   * 실측 실패 사례: "공통 컴포넌트화 대신 공통 컴포넌트로 만들지 않음을 골랐을까요?"
   *   — 같은 대상을 긍정/부정으로 쓴 것이라 질문이 성립하지 않는다.
   */
  /** 받침 유무 — 한글이 아닌 끝(영문·숫자)은 없음으로 본다. */
  function hasFinalConsonant(word: string): boolean {
    const ch = word.trim().slice(-1);
    const code = ch.charCodeAt(0);
    if (Number.isNaN(code) || code < 0xac00 || code > 0xd7a3) return false;
    return (code - 0xac00) % 28 !== 0;
  }

  /** 조사 — 앱 lib/decision.ts 와 같은 규칙. 한쪽만 고치지 말 것. */
  const objectParticle = (w: string) => (hasFinalConsonant(w) ? "을" : "를");
  const subjectParticle = (w: string) => (hasFinalConsonant(w) ? "은" : "는");

  function comparablePair(chosen: string, rejected: string): boolean {
    if (!chosen || !rejected) return false;
    if (chosen.length > 20 || rejected.length > 20) return false; // 문장이면 탈락
    if (/(선택|도입|적용|채택|사용|변경|전환)$/.test(chosen.trim())) return false; // 서술형 꼬리
    if (/(선택|도입|적용|채택|사용|변경|전환)$/.test(rejected.trim())) return false;
    if (/않|안 하|없이|미사용|제외/.test(chosen + rejected)) return false; // 부정 서술
    const norm = (v: string) => v.replace(/[\s·]/g, "");
    const a = norm(chosen);
    const b = norm(rejected);
    if (a.includes(b) || b.includes(a)) return false; // 한쪽이 다른 쪽을 포함
    return a.slice(0, 5) !== b.slice(0, 5); // 앞부분이 같으면 같은 대상
  }

  // 질문은 두 갈래로 만든다.
  //   ① 대조쌍(A 대신 B)이 온전하면 **조립**이 가장 안전하다 — 사실만으로 만들어진다.
  //   ② 아니면 LLM 이 쓴 질문을 게이트에 통과시킨 것만 쓴다.
  // 둘 다 없으면 null 로 두고, 앱이 유형 기반 템플릿으로 폴백한다.
  const qs = (parsed.questions ?? {}) as Record<string, unknown>;
  const specifics = specificTokens(String(art.title ?? ""), decision);
  const builtQuestion =
    hasDecision && comparablePair(decision.chosen, decision.rejected)
      ? `${blogName ? `${blogName}${subjectParticle(blogName)} 왜 ` : "왜 "}${decision.rejected} 대신 ${decision.chosen}${objectParticle(decision.chosen)} 골랐을까요?`
      : null;
  const question = builtQuestion ?? usableQuestion(str(qs.insight), specifics);
  const applyQuestion = usableQuestion(str(qs.apply), specifics);
  // ③ 가설 질문 — 일반 게이트에 **원인 되묻기 금지**를 한 겹 더 얹는다.
  //    통과 못 하면 null 이고, 앱이 결정 카드 조립 → 유형 템플릿으로 내려간다.
  const rawHypothesis = usableQuestion(str(qs.hypothesis), specifics);
  const hypothesisQuestion =
    rawHypothesis && !CAUSE_Q.test(rawHypothesis) ? rawHypothesis : null;

  const lvl = str(parsed.level);
  const level = lvl === "easy" || lvl === "terms" || lvl === "code" ? lvl : null;

  const terms = Array.isArray(parsed.terms)
    ? (parsed.terms as Record<string, unknown>[])
        .map((t) => ({
          term: str(t.term),
          plain: str(t.plain),
          why: str(t.why),
          domain: str(t.domain),
        }))
        .filter((t) => t.term && t.plain)
        .slice(0, 4)
    : [];

  await supabase
    .from("articles")
    .update({
      decision: hasDecision ? decision : null,
      question,
      apply_question: applyQuestion,
      hypothesis_question: hypothesisQuestion,
      level,
      terms,
      read_minutes: readMinutes(body),
    })
    .eq("id", articleId);

  return {
    ok: true,
    hasDecision,
    question,
    applyQuestion,
    hypothesisQuestion,
    level,
    terms: terms.length,
  };
}

// 토론 주제 + 여는 글(+원문) 요약 — 모드별.
async function summarizeDiscussionContent(discussionId: string, mode: Mode): Promise<string> {
  const supabase = serviceClient();
  const { data: disc, error } = await supabase
    .from("discussions")
    .select("id, title, prompt, body, url")
    .eq("id", discussionId)
    .single();
  if (error || !disc) throw new Error("토론을 찾을 수 없음");

  const parts: string[] = [`주제: ${disc.title}`];
  const opening = disc.body || disc.prompt;
  if (opening) parts.push(`여는 글: ${opening}`);
  if (disc.url) {
    try {
      const extracted = extractArticle(await fetchHtml(disc.url), disc.url);
      if (extracted.text) parts.push(`원문: ${extracted.text}`);
    } catch {
      // 원문 확보 실패 무시
    }
  }
  const source = parts.join("\n");
  const summary = (await llmSummarize(source, CONTENT_SYS[mode])) ?? `${disc.title} — 요약할 내용이 부족해요.`;

  const { data: cur } = await supabase.from("discussions").select("ai_summaries").eq("id", discussionId).single();
  const merged = { ...(cur?.ai_summaries ?? {}), [mode]: summary };
  await supabase.from("discussions").update({ ai_summaries: merged }).eq("id", discussionId);
  return summary;
}

// 토론 결과(의견 + 고정 결론) 요약.
async function summarizeDiscussionResult(discussionId: string): Promise<string> {
  const supabase = serviceClient();
  const { data: disc, error } = await supabase
    .from("discussions")
    .select("id, title, prompt, body, conclusion_comment_id")
    .eq("id", discussionId)
    .single();
  if (error || !disc) throw new Error("토론을 찾을 수 없음");

  const { data: comments } = await supabase
    .from("comments")
    .select("id, text")
    .eq("target_type", "discussion")
    .eq("target_id", discussionId)
    .order("created_at", { ascending: true });

  // 의견이 하나도 없으면 요약(환각) 대신 "내용 없음"을 명확히 저장.
  if (!comments || comments.length === 0) {
    const msg = "아직 토론에 오간 의견이 없어요. 의견이 쌓이면 요약해드릴게요.";
    await supabase.from("discussions").update({ ai_summary: msg }).eq("id", discussionId);
    return msg;
  }

  const conclusion = comments.find((c) => c.id === disc.conclusion_comment_id);
  const parts: string[] = [`토론 주제: ${disc.title}`];
  const opening = disc.body || disc.prompt;
  if (opening) parts.push(`여는 글: ${opening}`);
  parts.push("", "[참여자 의견]");
  for (const cm of comments ?? []) parts.push(`- ${cm.text}`);
  if (conclusion) parts.push("", "[방장이 고정한 결론]", conclusion.text);

  const summary =
    (await llmSummarize(parts.join("\n"), RESULT_SYS)) ?? `${disc.title} — 아직 요약할 내용이 부족해요.`;
  await supabase.from("discussions").update({ ai_summary: summary }).eq("id", discussionId);
  return summary;
}

// ============================================================================
// 분류(기준 v1) — 대분류 1개. 본문을 읽고 판단한다.
// ----------------------------------------------------------------------------
// 같은 글을 3번 판정해 다수결로 정한다. 왜 3번인가:
//   한 번만 물으면 애매한 글에서 답이 흔들린다. 흔들리는 글은 **분류하지 않는 게 맞고**,
//   그걸 알아내는 가장 싼 방법이 같은 질문을 몇 번 더 해보는 것이다.
//   두 번 이상 같은 답이 나오지 않으면 topic 을 비워 둔다(억지로 넣지 않는다).
// 근거 문장은 본문과 글자 대조한다 — 지어낸 근거는 그 판정을 통째로 버린다.
/**
 * @param dry 판정만 하고 **DB 에 쓰지 않는다** — 감사(`scripts/audit-classify.mjs --cross`)용.
 *            검증 도구가 검증 대상을 덮어쓰면 그건 검증이 아니다.
 */
async function classifyArticle(articleId: string, dry = false) {
  const supabase = serviceClient();
  const { data: art } = await supabase
    .from("articles")
    .select("id, title, body, url")
    .eq("id", articleId)
    .single();
  if (!art) return { ok: false, reason: "글 없음" };

  let body: string = cleanBody(art.body ?? "");
  if (!body) {
    const html = await fetchHtml(art.url);
    if (html) body = cleanBody(stripFooter(extractArticle(html).text ?? ""));
  }
  if (body.length < 300) return { ok: false, reason: "본문이 너무 짧음" };
  // 한국어 글이 아니면 판정하지 않고 바로 뺀다(위 isKorean 주석 참고).
  if (!isKorean(body)) {
    const failed = await (async () => {
      if (dry) return null;
      const { error } = await supabase
        .from("articles")
        .update({
          topic: null,
          planner_included: false,
          planner_category: null,
          planner_evidence: null,
          planner_summary: "본문이 한국어가 아니다",
          planner_version: "v2-auto",
          planner_at: new Date().toISOString(),
        })
        .eq("id", articleId);
      return error ? `저장 실패 — ${error.message}` : null;
    })();
    if (failed) return { ok: false, reason: failed };
    return { ok: true, topic: null, include: false, reason: "한국어 본문 아님", dry };
  }

  // 입력을 조인다(위 guideArticle 주석 참고). 결론은 글 앞부분에서 거의 드러난다.
  const input = `제목: ${art.title}

본문:
${body.slice(0, 2500)}`;

  /**
   * 판정은 최대 3회지만 **앞 둘이 같으면 거기서 멈춘다.**
   *
   * 다수결의 목적은 "흔들리는 글을 걸러내는 것"이고, 두 번 연속 같은 답이 나왔다면
   * 그 목적은 이미 달성됐다. 세 번째는 토큰만 쓴다 — Groq 무료 티어는 분당 8,000 토큰이라
   * 그 한 번이 처리 속도를 절반으로 떨군다. 앞 둘이 갈릴 때만 세 번째로 가른다.
   */
  const verdicts: Verdict[] = [];
  const dropped: string[] = [];
  /**
   * 게이트에서 거절한 근거 문장들 — **다음 질문에 붙여서 돌려준다.**
   *
   * 거절만 하고 이유를 안 주면 모델은 같은 답을 반복한다(실측: 메타 문장 한 건을
   * 세 번 연속 그대로 내놓아 판정이 통째로 실패했다). 무엇이 왜 안 되는지 알려줘야
   * 다른 문장을 고른다.
   */
  const banned: string[] = [];
  // 상한 3회. 게이트에 걸린 시도도 한 번을 먹으므로, 근거를 세 번 연속 잘못 고르면 판정은 실패한다
  // (억지로 채우느니 비워 두는 편이 낫다 — 감사가 "판정 없음"으로 드러낸다).
  for (let i = 0; i < 3; i++) {
    if (verdicts.length === 2 && verdicts[0].topic === verdicts[1].topic) break;
    const sys = banned.length
      ? `${CLASSIFY_SYS}

⚠️ 아래 문장은 이미 거절됐다. **근거로 다시 쓰지 마라.**
` +
        banned.map((b) => `- ${b}`).join("\n") +
        `
글이 무엇을 쓸 것인지가 아니라, **무엇을 했고 무엇이 달라졌는지**를 말하는 문장을 골라라.`
      : CLASSIFY_SYS;
    // 추론형 모델은 생각에 토큰을 먼저 쓴다 — 넉넉히 준다(위 callGroq 주석 참고).
    const raw = await llmSummarize(input, sys, 1200);
    if (!raw) continue;
    const v = parseVerdict(parseJsonLoose(raw));
    if (!v) continue;
    // 근거를 본문에서 못 찾으면 그 판정은 버린다("예"라고 답할 자격이 없다).
    if (v.include && v.topic && !evidenceInBody(v.evidence, body)) {
      dropped.push("근거 불일치");
      continue;
    }
    // 근거가 '글에 대한 글'이면 버린다 — 어느 글에나 있는 문장이라 대분류를 가르지 못한다.
    if (v.include && v.topic && isMetaSentence(v.evidence)) {
      dropped.push("근거가 메타 문장");
      banned.push(v.evidence.slice(0, 90));
      continue;
    }
    verdicts.push(v);
  }
  if (verdicts.length === 0) {
    return { ok: false, reason: `판정 실패 — ${(lastLlmError ?? "근거 불일치").slice(0, 80)}`, dropped };
  }

  const { topic, include } = majority(verdicts);

  /**
   * 태그는 **가장 많이 나온 값**으로 정한다(topic 과 같은 다수결).
   * 한 번만 나온 태그는 버린다 — 모델이 한 번 스쳐 떠올린 말은 색인이 되면 안 된다.
   */
  const purposeCount = new Map<string, number>();
  const detailCount = new Map<string, number>();
  for (const v of verdicts) {
    if (v.purpose) purposeCount.set(v.purpose, (purposeCount.get(v.purpose) ?? 0) + 1);
    for (const d of v.details) detailCount.set(d, (detailCount.get(d) ?? 0) + 1);
  }
  const topPurpose =
    [...purposeCount.entries()].sort((a, b) => b[1] - a[1]).find(([, n]) => n >= 2)?.[0] ?? null;
  const tags = [...detailCount.entries()]
    .filter(([, n]) => n >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([t]) => t);
  /** 다수결에서 이긴 판정 — 근거 문장은 이 판정의 것을 쓴다(진 판정의 근거를 섞으면 앞뒤가 안 맞는다). */
  const winner = verdicts.find((v) => v.topic === topic) ?? verdicts[0];

  /**
   * ⚠️ **저장 결과를 반드시 확인한다.**
   * 예전에는 `.update({ topic, purpose_tag, tags })` 를 쓰고 결과를 안 봤다.
   * 그런데 `purpose_tag` 컬럼은 진작에 없어졌고(정본은 `planner_tags`),
   * 없는 컬럼이 하나 섞이면 PostgREST 는 **update 전체를 거절한다**.
   * 그런데도 이 함수는 `ok: true` 에 topic·purpose 까지 채워 돌려줬다 —
   * 스크립트도 cron 도 성공으로 읽었고, 실제 DB 에는 **한 글자도 안 들어갔다**.
   * 매시 30분 분류가 통째로 헛돌면서 미분류가 줄지 않은 원인이 이것이다(실측으로 확인).
   * 그래서 여기서는 error 를 받아 보고, 실패면 실패라고 말한다.
   */
  const save = async (patch: Record<string, unknown>) => {
    if (dry) return null;
    const { error } = await supabase.from("articles").update(patch).eq("id", articleId);
    return error ? `저장 실패 — ${error.message}` : null;
  };

  /**
   * 판정 기록 — `ai_use(상),ai_use(중),제외(하)` 처럼 **표가 어떻게 갈렸는지** 남긴다.
   *
   * 같은 글을 다시 물으면 다른 답이 나오는 일이 있다(실측: 한 글이 data_exp → quality_risk
   * → 제외 로 세 번 다르게 나왔다). 다수결은 그걸 **덮어서 하나로 만들 뿐** 없애지 못한다.
   * 그래서 덮은 자리를 기록해 둔다 — 그래야 나중에 토큰 한 톨 안 쓰고
   * "이 글은 겨우 정해졌다"를 찾아낼 수 있다(`scripts/audit-classify.mjs`).
   */
  const votes = verdicts.map((v) => `${v.topic || "제외"}(${v.confidence})`).join(",");
  const stamp = {
    planner_votes: votes,
    planner_version: "v2-auto",
    planner_at: new Date().toISOString(),
  };

  if (!include) {
    // 제외 판정 — 글을 지우지 않는다(달린 인사이트·밑줄이 사라진다). 분류만 비운다.
    const failed = await save({
      topic: null,
      planner_included: false,
      planner_category: null,
      planner_evidence: null,
      planner_summary: winner.conclusion || null,
      ...stamp,
    });
    if (failed) return { ok: false, reason: failed };
    return { ok: true, topic: null, include: false, votes: verdicts.length, dry };
  }
  if (!topic) return { ok: false, reason: "다수결 불성립", votes: verdicts.map((v) => v.topic) };

  const failed = await save({
    topic,
    tags,
    planner_included: true,
    planner_category: CATEGORY_LABEL[topic],
    planner_evidence: winner.evidence || null,
    planner_summary: winner.conclusion || null,
    planner_tags: {
      ...(topPurpose ? { purpose: topPurpose } : {}),
      methods: winner.methods,
      contexts: winner.contexts,
      tech: winner.tech,
    },
    ...stamp,
  });
  if (failed) return { ok: false, reason: failed };

  return {
    ok: true,
    topic,
    category: CATEGORY_LABEL[topic],
    purpose: topPurpose,
    evidence: winner.evidence,
    tags: tags.length,
    votes: verdicts.length,
    dropped: dropped.length,
    dry,
  };
}

// ============================================================================
/**
 * 근거 문장 하나만 주고 **어느 칸으로 읽히는지** 되묻는다.
 *
 * 붙어 있는 대분류를 알려주지 않는다 — 알려주면 모델이 거기에 맞춰 준다.
 * 맞히면 근거가 그 칸을 실제로 가리키는 것이고, 어긋나면 둘 중 하나다:
 * 근거가 약하거나(본문에 있긴 한데 결론이 아님), 대분류가 틀렸거나.
 * **어느 쪽인지는 기계가 정하지 않는다.** 감사가 사람 앞에 나란히 놓는다.
 */
const VERIFY_SYS = `너는 한 문장을 읽고 **그 문장만으로** 어느 칸에 들어갈 글인지 고르는 분류기다.
반드시 아래 JSON 하나만 출력해라(설명·코드펜스 금지).
{"topic":"","confidence":"상|중|하"}

칸(하나만 고른다):
  quality_risk : 품질 보증·장애·보안·개인정보·리스크를 줄인 이야기
  ai_use       : AI 로 일하는 방식을 바꿨거나 AI 기능을 만든 이야기
  product_plan : 없던 서비스·기능을 내놓았거나 정책·로드맵을 바꾼 이야기
  data_exp     : 지표·분석·가설 검증·A/B 테스트로 판단한 이야기
  user_exp     : 사용자의 문제·행동을 알아냈거나 이미 있던 화면·흐름을 고친 이야기
  biz_brand    : 매출·수익화·시장·브랜드가 결론인 이야기
  collab       : 팀이 일하는 방식(협업·출시 과정·운영 방식)이 결론인 이야기

⚠️ 문장 하나로는 고르기 어려울 수 있다. 그럴 때 억지로 고르지 말고 confidence 를 '하'로 둬라 —
   **'하'는 틀린 답이 아니라 "이 문장만으로는 못 고른다"는 뜻이고, 그 자체가 쓸모 있는 답이다.**
   (근거가 그 칸을 가리키지 못한다는 뜻이니까.)`;

async function verifyEvidence(articleId: string) {
  const supabase = serviceClient();
  const { data: art } = await supabase
    .from("articles")
    .select("id, title, topic, planner_evidence")
    .eq("id", articleId)
    .single();
  if (!art) return { ok: false, reason: "글 없음" };
  const ev = (art.planner_evidence ?? "").trim();
  if (!ev) return { ok: false, reason: "근거 없음" };

  const raw = await llmSummarize(`문장: ${ev}`, VERIFY_SYS, 300);
  if (!raw) return { ok: false, reason: lastLlmError ?? "LLM 오류" };
  const parsed = parseJsonLoose(raw) as Record<string, unknown> | null;
  if (!parsed) return { ok: false, reason: "파싱 실패" };

  const guess = typeof parsed.topic === "string" ? parsed.topic : "";
  return {
    ok: true,
    mine: art.topic,
    guess: (TOPICS as string[]).includes(guess) ? guess : "",
    confidence: typeof parsed.confidence === "string" ? parsed.confidence : "?",
    agree: guess === art.topic,
  };
}

// 읽기 가이드(§33) — 테크 블로그를 비개발자가 따라 읽게 만드는 층
// ----------------------------------------------------------------------------
// 원문을 **재배치하지 않는다.** 번호 매긴 블록 목록을 주고, 이야기가 바뀌는 지점의
// 번호만 받아온다. 끝 번호는 받지 않는다 — 다음 단계의 직전이 곧 끝이라
// 구간이 비거나 겹치는 일이 구조적으로 불가능하다.
//
// 왜 "문장을 골라줘"가 아니라 "경계 번호를 줘"인가:
//   · 문장을 고르게 하면 고르지 않은 문단은 갈 곳이 없다(내용 누락).
//   · 경계만 받으면 본문 전체가 자동으로 덮인다. AI 가 틀려도 잃는 건 제목뿐이다.
const GUIDE_SYS = `너는 기술 블로그 글을 **개발을 전혀 모르는 사람**(기획자·디자이너·마케터)에게
뉴스처럼 풀어 주는 한국어 편집자다.
반드시 아래 JSON 하나만 출력해라(설명·코드펜스 금지).
{"summary":"","terms":[{"term":"","plain":""}],"lead":{"what":"","why":"","how":"","soWhat":""},"plannerPoint":"","sections":[{"question":"","problem":"","paras":[""],"outcome":"","blocks":[0],"terms":[""]}]}

가장 중요한 규칙: **구현 과정을 순서대로 나열하지 마라.**
"메타데이터를 붙여 임베딩을 만들었다" 같은 문장은 개발자가 한 일의 순서일 뿐,
읽는 사람에게는 아무 의미가 없다. 기술이 나오면 **그걸로 무엇을 하려 했는지**로 바꿔 써라.

1) summary: 이 글이 무슨 얘긴지 2문장. 존댓말(~해요). 전문용어 없이.

2) lead: 읽는 사람이 실제로 묻는 **네 가지**에 답한다. 존댓말(~해요).
   **글자 수를 묶지 않는다** — 여기는 글 전체를 1분에 파악하는 자리라, 필요한 만큼 쓴다.
   다만 **같은 말을 두 번 하지 마라.** 길이를 채우려고 앞 문장을 바꿔 쓰면 오히려 읽기 어려워진다.
   - what   (어떤 문제가 있었어요?) : **주어로 시작한다** — "당근은", "카카오페이 정산팀은".
     누구 이야기인지 없으면 남의 일처럼 읽힌다.
     **세 박자로 쓴다.** 한 박자라도 빠지면 문장이 툭툭 끊긴다.
       ① 무엇이 **되풀이되고 있었는지** (상황)
       ② 그래서 **누가 어떤 불편을 겪었는지** (그 상황이 실제로 만든 문제)
       ③ 그런데 **그걸 고치려니 왜 어려웠는지** (그대로 둘 수밖에 없던 이유)
     ②를 빠뜨리는 실수가 잦다 — ①에서 ③으로 건너뛰면 "반복됐다, 그래서 조건 맞추기가 힘들다"가
     되어 **왜 그게 문제인지**가 사라진다. ②가 이 칸의 핵심이다.
     ⚠️ 세 박자는 **서로 다른 말**이어야 한다. ①과 ③에 같은 문구를 쓰지 마라
     (실측: "조건을 일일이 맞춰야 해서 …" 가 ①과 ③에 그대로 두 번 나왔다).
       · ① 은 **상황**(무엇이 반복됐나) · ② 는 **피해**(누가 불편했나) · ③ 은 **걸림돌**(왜 못 고쳤나).
     ⚠️ **가정문으로 쓰지 마라.** "~하면 ~해요"는 그 팀에게 있었던 일이 아니라 일반론이다.
        실제로 일어난 일을 **과거형**으로 쓰고, 세 박자가 **접속사로 이어지게** 한다
        (그런데 / 그래서 / 그렇다고).
        형태만 보여 주는 **틀**이다(내용은 이 글에서만 가져온다):
          "〈주어〉는 〈되풀이된 일〉이 있었어요.
           **그런데** 〈그 때문에 누가 어떻게 불편했는지〉.
           **그렇다고** 〈고치려니 무엇이 걸렸는지〉."
        ⚠️ **이 틀의 낱말을 가져다 쓰지 마라.** 예전에 여기 긴 예문을 적어 두었더니 모델이
        그 문장을 **다른 글의 요약에 그대로 베껴** 넣었다(실측: 배치 처리 글에 "최소·최대
        수량, 언어 설정" 이 나왔는데 본문에 없는 말이었다). 없는 사실을 쓰는 건 가장 나쁜 실패다.
     ⚠️ 여기서 **결론을 내지 마라.** "그래서 ~를 만들었어요"는 아래 how 칸의 몫이다.
     위에서 결론을 내면 how 와 같은 말이 되어 그 칸이 통째로 버려진다.
   - why    (왜 풀어야 했대요?)      : 그대로 뒀을 때 **실제로 무엇이 나빠지고 있었는지.**
     ⚠️ **"이렇게 하면", "이럴 경우" 로 시작하지 마라.** 그건 가정이지 겪은 일이 아니다.
        원문에 적힌 일을 과거형으로 쓴다. 문장을 **"~였어요 / ~했어요"** 로 끝낸다.
        · 나쁜 예: "이렇게 하면 같은 기능을 여러 번 만들면서 버그가 생겨요."
        · 좋은 예: "같은 기능을 서비스마다 다시 만들다 보니 고칠 곳이 계속 늘었어요."
   - how    (뭘 했대요?)            : 그 문제를 **어떻게 풀었는지.** 무엇을 만들고 무엇을 바꿨는지.
     ⚠️ "여섯 가지를 만들었어요"처럼 개수만 쓰지 말고 **무엇무엇인지 이름까지** 적는다.
     ⚠️ 기술·라이브러리 이름을 나열하지 마라("Spring Batch의 Partitioning과 Cursor 기반
     ItemReader를 이용해…"는 틀린 답이다). **무엇이 되게 했는지**로 써라.
   - soWhat (그래서 뭐가 달라졌어요?): 무엇이 좋아졌는지, 무엇이 남았는지.
   네 칸 모두 **원문에 근거가 있어야** 한다. 원문에 없으면 그 칸은 빈 문자열로 둔다.
   ⚠️ 네 칸이 **서로 다른 것을 말해야** 한다. what 에 방법을, how 에 결과를 적지 마라.

3) plannerPoint: **이 팀이 던진 질문을 내 일에도 던진다면 무엇인가.** 1~2문장, 200자 이내, 존댓말.
   - 교훈을 지어내라는 게 아니다. 이 팀이 **실제로 확인한 것**을 적고,
     그걸 "비슷한 걸 검토한다면 같은 것을 확인해 보라"로 이어 쓴다.
   - 좋은 예:
     · "이 팀은 프로토타입을 2주 만에 붙여 사용자에게 먼저 물었어요. 검증에 몇 달을 쓰기 전에
        '지금 손에 쥔 것으로 물어볼 수 있나'를 먼저 따져볼 만해요."
     · "여기선 데이터를 한 번에 처리할 수 있는지를 '지금 양'이 아니라 '10배가 됐을 때'로 봤어요."
   - 나쁜 예(절대 이렇게 쓰지 마라):
     · "참고할 만한 글이에요." — 아무것도 말하지 않는다.
     · "~하는 사례를 참고하면 ~을 이해할 수 있습니다." — 글을 읽으라는 말의 반복이다.
     · soWhat 을 바꿔 쓴 문장 — 이미 위에 있다. **다른 것을 말해야 한다.**
   - ⚠️ 원문에 그 팀이 무엇을 확인·비교·선택했는지가 **전혀 없으면 빈 문자열**로 둔다.

4) sections: 글이 다룬 **문제·국면을 하나씩** 맡는 칸. **3~6개**(아주 짧은 글만 2개).
   - ⚠️ **리드에 여러 개를 나열했으면 나열한 것마다 칸을 만든다.**
     "여섯 가지를 만들었어요 — 수량, 시간, 날짜, 목록, 팝업, 스크롤"이라고 써 놓고
     칸을 셋만 만들면, 읽는 사람은 "왜 저것만 다뤘지?" 하게 된다(실제로 그랬다).
     여섯을 꼽았으면 여섯을 다룬다. 못 다룰 것은 리드에서도 꼽지 마라.
   - lead 의 "왜 했대요"에 뭉쳐 적은 것들을 **여기서 하나씩 풀어 준다.**
     문제가 셋이면 칸도 셋이다. 두 문단으로 요약하고 넘어가지 마라 — 그러면 위 요약과 똑같아진다.
   - **글이 이야기한 순서대로** 놓는다.
   - question: **물음표로 끝나는 질문형 소제목.** 존댓말로 쓴다 — "왜 검색이 안 맞았을까요?"
     ("~할까?", "~했대?" 같은 반말은 쓰지 마라. 본문이 존댓말이라 카드 안에서 말투가 갈린다.)
   - ⚠️ 칸 전부를 "왜 ~였나요?"로 만들지 마라. 문제만 네 번 반복하면 글이 한 자리에 머문다.
     글이 실제로 다룬 것에 맞춰 **묻는 각도를 바꾼다** —
     문제(왜 그랬대?) · 선택(뭘 골랐대?) · 방법(어떻게 했대?) · 반응(사람들은 뭐래?).
   - ⚠️ 질문은 **lead 에 이미 나온 이야기**를 파고드는 것이어야 한다.
     lead 에 없던 새 개념을 소제목으로 올리지 마라 — 원문을 안 본 사람은 거기서 길을 잃는다.
   - ⚠️ 질문에 **기술 이름을 쓰지 마라.** "Cursor 기반 ItemReader는 어떤 역할인가요?"가 아니라
     "데이터가 많으면 왜 터지는 거야?"처럼 **그 기술이 해결한 문제**로 물어라.
   - problem: 이 칸이 다루는 **문제** 한 문장. 무엇이 안 되고 있었는지.
   - paras: **한 개만** 쓴다(1~2문장, 200자 이내, 존댓말). 이 단계는 뼈대를 잡는 곳이라
     길게 쓰면 출력이 잘려 **뒤쪽 칸이 통째로 사라진다**(실제로 그랬다).
     그 한 문단은 **어떻게 풀었는지**를 적는다 — 문제는 위 problem 이 맡는다.
   - outcome: **그래서 이건 어떻게 됐어요?** 이 칸 하나의 결말을 한 문장으로.
     위 soWhat 은 글 전체의 결말이라 칸마다의 답이 안 된다. **이 칸에서 다룬 것만** 말한다.
     원문에 그 칸의 결과가 없으면 빈 문자열로 둔다.
   - blocks: 그 답을 쓸 때 **실제로 근거가 된 원문 블록 번호를 전부** 적는다(1~3개).
     한 개만 적지 마라 — 답은 여러 군데를 모아 쓰는데 근거가 한 문단뿐이면
     읽는 사람은 "이걸로 저 답이 나온다고?" 하게 된다. 전부 실제 번호여야 한다.
   - terms: 그 칸에 쓴 단어 중 개발을 모르면 막힐 단어(없으면 빈 배열).

5) terms(맨 위): 용어를 고르는 기준은 **하나**다 —
   **"이 말을 모르면 내가 쓴 이 문장을 이해할 수 없는가?"**
   그렇다면 용어다. 아니라면 넣지 마라. "모르는 말"을 모으는 게 아니라
   **이해를 막는 말**을 치우는 자리다. 5~8개 고른다.

   판별하는 방법: **그 말을 지우고 다시 읽어 보라.**
     · 뜻이 통하면 → 필요 없는 말이다.
       "Local Partitioning 전략을 골랐어요" 에서 그 이름을 지워도
       "데이터를 나눠 동시에 처리하는 방식을 골랐어요" 로 통한다 → **넣지 마라.**
     · 문장이 막히면 → 용어다.
       "OOM 이 발생해 작업이 멈췄어요" 는 OOM 을 모르면 무슨 일인지 알 수 없다 → **넣어라.**
       (회의에서 그 말을 쓸 일이 있는지는 **묻지 마라.** OOM 은 기획자가 말할 일이 없어도
        이 문장을 읽으려면 알아야 한다. 기준은 쓸모가 아니라 **이해**다.)

   못 들어가는 두 갈래:
     ① 누구나 아는 말 — 화면 · 속도 · 사용자 · 문제
     ② 몰라도 문장이 통하는 말 — **구현 부품 이름**(Worker Step · Manager Step ·
        PartitionHandler · ItemReader). 개발자끼리 역할을 가리키는 이름이라,
        지우고 읽어도 뜻이 그대로다.

   자주 들어가는 갈래: 기술 개념(파티셔닝·임베딩·A/B 테스트) · 영어 약어(OOM·TPS·PoC) ·
   한국어인데 이 분야에서 다른 뜻으로 쓰는 말(적재·정산·전표·정합성·롤링 포캐스트).
   - 영어 약어(OOM, API, TPS…), 업계 은어(배치, 워커, 파티션, 인덱스…),
     **한국어인데 이 분야에서 다른 뜻으로 쓰는 말**(적재, 정산, 동기화, 롤백…)을 모두 포함한다.
   - 마지막 종류를 빠뜨리지 마라 — 한국어라 쉬워 보이지만 제일 많이 막히는 말이다.
   - ⚠️ **네가 위에서 쓴 표기 그대로** 적는다. 원문이 "Bottom Sheet" 인데 너는 "바텀 시트"라고
     썼다면 "바텀 시트"로 적어라. 네가 쓴 말과 다르면 그 단어에 밑줄이 안 그어져 아무 일도 안 한다.
   - plain 은 50자 이내로 쉽게.
   - 누구나 아는 일상어(속도, 화면, 사용자, 문제)는 넣지 마라.

6) 숫자와 고유명사는 **원문에 있는 것만** 쓴다. 어림짐작으로 만들지 마라.
   ⚠️ 문장 안에 블록 번호를 쓰지 마라. "(블록 13)", "(블록 45~48)" 같은 표시는 금지다 —
   그건 너한테 준 참고 번호이지, 읽는 사람이 볼 것이 아니다. 근거는 block 필드에만 적는다.
7) 전부 한국어. 원문 문장을 그대로 복사하지 말고 네 말로 다시 써라.`;

/** 숫자 토큰(단위 포함) — "3초", "0.4초", "200만", "78%" 같은 것. */
function numberTokens(text: string): string[] {
  return (text.match(/[0-9][0-9.,]*\s*(%|초|분|시간|배|만|억|천|명|건|ms|s|GB|MB|KB|TB)?/g) ?? [])
    .map((t) => t.replace(/\s+/g, ""))
    .filter((t) => t.length >= 2);
}

/**
 * 게이트 — 통과 못 하면 **저장하지 않는다**.
 *
 * AI 가 사실을 다시 쓰기 때문에 검사가 빡빡하다. 특히 **숫자**는 지어내면 그대로 거짓이 되므로,
 * 요약에 쓴 숫자가 원문에 글자 그대로 있는지 대조한다. 하나라도 없으면 전체를 버린다
 * (그 칸만 빼면 남은 칸들이 앞뒤가 안 맞는 설명이 된다).
 */
/**
 * 모델이 본문에 흘린 블록 표기를 지운다 — "(블록 13)", "(블록 45~48)".
 * 프롬프트로 금지해도 가끔 샌다. 사실 오류가 아니라 **표기 실수**라서 통째로 버리지 않고 지운다.
 */
/**
 * 근거 블록 번호 목록 — 본문 범위 밖·중복·**너무 짧은 덩어리**는 버린다.
 *
 * ⚠️ 소제목도 블록 하나다. 모델이 "ScrollAutoHide" 같은 **소제목 블록**을 근거로 달면
 *    펼쳤을 때 단어 하나만 뜬다(실제 증상). 그건 근거가 아니라 목차다.
 *    처음엔 "40자 미만"으로 잘랐는데 **너무 거칠었다** — 실측(본문 40건·블록 3,595개)에서
 *    20~39자 구간에 "안녕하세요, 카카오페이 정산플랫폼팀의 와이입니다." 같은 **멀쩡한 한 문장**이
 *    섞여 있었고, 그 구간이 9.5%였다. 길이가 아니라 **종류로** 거른다:
 *      · `kind === "heading"` 은 제외한다(소제목은 근거가 아니다)
 *      · 25자 미만도 제외한다(그 아래는 바이라인·인사말뿐이었다)
 * 범위 밖 하나 때문에 칸 전체를 버리지는 않는다(다른 근거가 남아 있으면 그걸로 충분하다).
 */
function blockList(
  raw: unknown,
  legacy: unknown,
  blockCount: number,
  usable: (i: number) => boolean,
): number[] {
  const src = Array.isArray(raw) ? raw : legacy != null ? [legacy] : [];
  const out: number[] = [];
  for (const v of src) {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < 0 || n >= blockCount || out.includes(n)) continue;
    if (!usable(n)) continue;
    out.push(n);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * 두 문장이 얼마나 같은 말인가 — 2글자 묶음(bigram)이 겹치는 비율.
 * 문장 하나가 다른 하나를 바꿔 쓴 것인지 가려내는 데 쓴다. 형태소 분석 없이도 한국어에서
 * 꽤 잘 맞는다("A를 했어요" / "A를 하게 됐어요" 는 0.7 이상으로 잡힌다).
 */
function overlapRatio(a: string, b: string): number {
  const grams = (s: string) => {
    const x = s.replace(/\s+/g, "");
    const out = new Set<string>();
    for (let i = 0; i + 2 <= x.length; i++) out.add(x.slice(i, i + 2));
    return out;
  };
  const A = grams(a);
  const B = grams(b);
  if (A.size === 0 || B.size === 0) return 0;
  let hit = 0;
  for (const g of A) if (B.has(g)) hit++;
  return hit / A.size;
}

/**
 * 한 칸 안에서 **같은 말을 두 번 하는 문장**을 걷어낸다.
 * 리드의 길이 제한을 풀었더니 모델이 자리를 채우려고 앞 문장을 바꿔 쓰는 일이 생겼다.
 * 문장 단위로 잘라 앞 문장과 많이 겹치면 버린다(칸 사이 중복은 overlapRatio 가 따로 본다).
 */
/**
 * **구현 부품 이름**인가 — 용어로 올리면 안 되는 말.
 *
 * 프롬프트로 "구현 부품 이름은 빼라"고 해도 새어 나온다(실측: Worker Step · Manager Step ·
 * PartitionHandler 가 용어 목록에 올라왔다).
 *
 * 기준은 **이해를 막는가** 하나다. 구현 부품 이름은 **지우고 읽어도 문장의 뜻이 그대로**라
 * 이해를 막지 않는다 — 그래서 빠진다.
 * ⚠️ "읽는 사람이 다시 쓸 일이 있나"로 재면 안 된다. OOM 은 기획자가 회의에서 말할 일이
 *    없지만 "OOM 이 발생해 멈췄어요" 를 읽으려면 반드시 알아야 한다. 기준은 쓸모가 아니다.
 *
 * 형태로 잡을 수 있는 것만 막는다. 이 접미사들은 코드 안에서 역할을 가리키는 관용어라
 * 목록이 닫혀 있다. 반대로 사용자가 **화면에서 보는** 부품(Dialog · Sheet · Picker)은
 * 기획자도 말할 일이 있어서 남긴다.
 */
const INTERNAL_SUFFIX =
  /(Handler|Manager|Factory|Builder|Adapter|Provider|Controller|Repository|Reader|Writer|Step|Job|Bean|Interceptor|Resolver|Dispatcher|Executor|Scheduler|Listener|Wrapper|Config|Mapper|Entity|DTO|DAO)$/i;

function isInternalPartName(term: string): boolean {
  const one = term.trim();
  // 한글이 섞였으면 개발자 전용 이름이 아니다("적재", "전표 마감").
  if (/[가-힣]/.test(one)) return false;
  return one.split(/\s+/).some((w) => INTERNAL_SUFFIX.test(w));
}

function dedupeSentences(s: string): string {
  const parts = s.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 0);
  const kept: string[] = [];
  for (const one of parts) {
    if (kept.some((k) => overlapRatio(one, k) > 0.55)) continue;
    kept.push(one.trim());
  }
  return kept.join(" ");
}

/**
 * 개발 문서 말투를 **쉬운 말로 바꿔 쓴다.**
 *
 * ⚠️ 금지어가 든 문단을 **버리지 않는다.** 한때 그러려고 했는데, 버리면 "어떻게 풀었는지"가
 *    통째로 사라져 칸이 `문제 → (빈칸) → 결과` 가 된다. 금지어 하나 때문에 내용을 잃는 건
 *    앞뒤가 안 맞는다. 멀쩡한 우리말이 있는 것은 **갈아 끼우면 손실이 없다.**
 *
 * 여기 없는 말(부품 이름 같은 것)은 그대로 둔다 — 바꾸면 뜻이 사라지고,
 * 그런 말은 "알아두면 편해요"가 밑줄과 뜻풀이로 받는다.
 *
 * 프롬프트에도 같은 금지 목록이 있다. 프롬프트는 대개 먹지만 가끔 새고(실측: locale),
 * 그때 마지막으로 거르는 그물이 여기다.
 */
const PLAIN_WORDS: [RegExp, string][] = [
  [/\blocale\b/gi, "언어·지역 설정"],
  [/\bprops\b/gi, "설정값"],
  [/비활성 상태/g, "선택할 수 없는 상태"],
  [/ESC 입력/g, "키보드로 닫기"],
  [/ESC 키/g, "키보드"],
  [/팝오버/g, "떠 있는 작은 창"],
  [/커스텀 레이블/g, "원하는 이름표"],
  [/네이티브 폼/g, "웹 기본 양식"],
  [/렌더링될 위치/g, "화면에 그려질 자리"],
  [/렌더링/g, "화면에 그리기"],
  [/\b패딩\b/g, "여백"],
  [/푸터 액션/g, "아래쪽 버튼"],
  [/\b푸터\b/g, "아래쪽 영역"],
];

function plainify(s: string): string {
  let out = s;
  for (const [re, to] of PLAIN_WORDS) out = out.replace(re, to);
  return out;
}

function stripBlockRefs(s: string): string {
  return plainify(s)
    .replace(/[（(]\s*블록\s*[0-9]+(\s*[-~–—]\s*[0-9]+)?\s*[)）]/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function gateGuide(
  parsed: Record<string, unknown>,
  blockCount: number,
  body: string,
  usableBlock: (i: number) => boolean,
): { ok: boolean; reason?: string; guide?: Record<string, unknown> } {
  const bodyFlat = body.replace(/\s+/g, "");

  const rawLead = (parsed.lead ?? {}) as Record<string, unknown>;
  /**
   * 리드는 **글자 수로 묶지 않는다** — 1분 파악을 맡는 자리라 필요한 만큼 쓰게 둔다.
   * 220자로 자르던 때는 세 박자를 쓰라고 해 놓고 자리를 안 줘서 **문장이 중간에 끊겼다**
   * (실측: "…개발자도 번거로" 에서 잘림). 상한은 폭주 방지용으로만 크게 남긴다.
   */
  const leadText = (v: unknown) => dedupeSentences(stripBlockRefs(str(v))).slice(0, 700);
  const lead = {
    what: leadText(rawLead.what),
    why: leadText(rawLead.why),
    how: leadText(rawLead.how),
    soWhat: leadText(rawLead.soWhat),
  };
  // 네 칸이 서로 다른 것을 말해야 한다 — 베낀 칸은 비운다(칸만 늘고 내용은 그대로면 손해다).
  if (lead.how && overlapRatio(lead.how, lead.what) > 0.55) lead.how = "";
  if (lead.soWhat && overlapRatio(lead.soWhat, lead.how) > 0.55) lead.soWhat = "";

  // ① 리드 — "무슨 일"은 반드시, 나머지 둘 중 하나는 있어야 한다.
  //    한 칸짜리 리드는 제목의 반복이지 설명이 아니다.
  if (lead.what.length < 15) return { ok: false, reason: "무슨 일인지가 비었음" };
  if (lead.why.length < 15 && lead.how.length < 15 && lead.soWhat.length < 15) {
    return { ok: false, reason: "왜/뭘/그래서가 전부 비었음" };
  }

  const rawSections = Array.isArray(parsed.sections) ? parsed.sections : [];
  const sections = rawSections
    .map((s) => {
      const o = (s ?? {}) as {
        question?: unknown;
        problem?: unknown;
        paras?: unknown;
        outcome?: unknown;
        blocks?: unknown;
        block?: unknown;
        terms?: unknown;
      };
      return {
        question: stripBlockRefs(str(o.question)).slice(0, 80),
        problem: stripBlockRefs(str(o.problem)).slice(0, 300),
        paras: Array.isArray(o.paras)
          ? o.paras
              .map((x) => stripBlockRefs(str(x)))
              .filter((x) => x.length > 0 && x.length <= 400)
              .slice(0, 5)
          : [],
        outcome: stripBlockRefs(str(o.outcome)).slice(0, 300),
        // blocks 가 정본. 옛 형식(block 하나)도 받아 배열로 만든다.
        blocks: blockList(o.blocks, o.block, blockCount, usableBlock),
        terms: Array.isArray(o.terms) ? o.terms.map(str).filter(Boolean).slice(0, 3) : [],
      };
    })
    // 1단계는 문단 하나면 충분하다 — 2단계가 원문을 읽고 3개로 다시 쓴다.
    .filter((s) => s.question.length > 0 && (s.paras.length > 0 || s.problem.length > 0));

  /**
   * ② 소제목은 **존댓말 질문**이어야 한다.
   * 명사구 소제목("컨텍스트 엔지니어링")이 올라오면 원문을 안 본 사람은 무슨 말인지 모른다.
   * 그리고 "~사용한 이유는?" / "~했을까?" 처럼 말투가 어긋나면 한 카드에 두 화자가 생긴다
   * (실측에서 둘 다 나왔다). 게이트에 걸리면 이제 **다시 물어보므로** 탈락 비용이 싸다.
   */
  const notQuestion = sections.find((s) => !/(요|까요|나요)\?$/.test(s.question));
  if (notQuestion) {
    return { ok: false, reason: `소제목이 존댓말 질문이 아님: ${notQuestion.question}` };
  }

  if (sections.length > 6) sections.length = 6;

  // ③ 칸 수 — 긴 글인데 칸이 하나뿐이면 그건 "더 들어간" 게 아니라 위 요약의 반복이다.
  //    짧은 글(덩어리 12개 미만)은 하나여도 정상이라 봐준다.
  if (blockCount >= 12 && sections.length < 2) {
    return { ok: false, reason: `칸이 ${sections.length}개뿐 (긴 글인데 덜 풀었다)` };
  }

  /**
   * 한 칸 안에서 **같은 말을 두 번 하지 않게** 한다.
   * 실측: "예측 정확도가 낮았던 이유는 …없어서" / "전통적인 방식 때문에 늦어졌어요" 처럼
   * 앞 문단을 바꿔 쓴 문단이 붙었다. 문단 수만 채우고 내용은 그대로라 읽는 사람만 손해다.
   * 결말이 **글 전체의 결말을 베낀 것**일 때도 버린다 — 칸마다 같은 말이 붙으면 소음이다.
   */
  for (const s of sections) {
    const kept: string[] = [];
    for (const para of s.paras) {
      if (kept.some((k) => overlapRatio(para, k) > 0.55)) continue;
      kept.push(para);
    }
    s.paras = kept;
    if (s.outcome && overlapRatio(s.outcome, lead.soWhat) > 0.55) s.outcome = "";
    if (s.outcome && s.paras.some((para) => overlapRatio(s.outcome, para) > 0.55)) s.outcome = "";
  }
  // 중복을 걷어내고 나니 빈 칸이 됐으면 그 칸은 없는 것이다.
  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i].paras.length === 0) sections.splice(i, 1);
  }

  // ③ 근거가 하나도 안 남았으면 그 칸은 확인할 길이 없다 — 통째로 버린다.
  const noBlocks = sections.find((s) => s.blocks.length === 0);
  if (noBlocks) return { ok: false, reason: `근거 블록이 없는 칸: ${noBlocks.question}` };

  /**
   * ④ 숫자 대조 — 요약에 쓴 숫자는 원문에 글자 그대로 있어야 한다.
   *
   * 벌의 크기를 자리에 맞춘다:
   *   · **리드**에 틀린 숫자가 있으면 전체를 버린다. 세 문답은 글의 뼈대라 한 칸만 빼면 앞뒤가 안 맞는다.
   *   · **칸 안의 문단·결말**은 그 문장만 버린다. 예전엔 숫자 하나에 가이드를 통째로 날려서,
   *     멀쩡한 칸 네 개까지 같이 사라지고 토큰만 썼다(실측: "원문에 없는 숫자: 18").
   */
  const madeUpNumber = (line: string) =>
    numberTokens(line).some((n) => !bodyFlat.includes(n.replace(/\s+/g, "")));

  for (const line of [lead.what, lead.why, lead.how, lead.soWhat]) {
    if (madeUpNumber(line)) return { ok: false, reason: `리드에 원문에 없는 숫자` };
  }
  for (const s of sections) {
    s.paras = s.paras.filter((para) => !madeUpNumber(para));
    if (s.problem && madeUpNumber(s.problem)) s.problem = "";
    if (s.outcome && madeUpNumber(s.outcome)) s.outcome = "";
  }
  for (let i = sections.length - 1; i >= 0; i--) {
    if (sections[i].paras.length === 0 && sections[i].problem.length === 0) sections.splice(i, 1);
  }
  if (sections.length === 0) return { ok: false, reason: "칸이 전부 탈락했다" };

  /**
   * ⑤ 용어 — **가이드 본문에 실제로 나오는 말만** 남긴다.
   *
   * 예전엔 "원문에 있는 말만"으로 걸렀다. 지어낸 용어를 막으려는 것이었는데, **엉뚱한 걸
   * 검사하고 있었다.** 용어의 쓰임은 원문이 아니라 **가이드 문장에 밑줄을 긋는 것**이다.
   * 가이드에 안 나오는 말은 통과시켜도 밑줄 그을 자리가 없어 아무 일도 안 한다.
   *
   * 게다가 제공자마다 결과가 갈렸다(실측):
   *   · 원문은 영어로 쓴다 — "Bottom Sheet", "SEED"
   *   · Groq 은 그 영어 토큰을 그대로 써서 통과, Gemini 는 "바텀 시트"로 **번역해서** 전부 탈락
   *   · 같은 글에서 용어 8개 vs 0개. 백업이 품질이 다르면 백업이 아니다.
   * 기준을 "가이드에 나오는가"로 바꾸면 표기가 영어든 한국어든 **같은 규칙**이 된다.
   *
   * 지어냄 방어는 그대로 남는다 — 가이드 문장 자체가 원문 대조(숫자·근거 블록)를 이미 거친다.
   */
  const guideText = [
    lead.what,
    lead.why,
    lead.how,
    lead.soWhat,
    stripBlockRefs(str(parsed.plannerPoint)),
    ...sections.flatMap((s) => [s.question, s.problem, ...s.paras, s.outcome]),
  ].join(" ");
  const rawTerms = (Array.isArray(parsed.terms) ? parsed.terms : [])
    .map((t) => {
      const o = (t ?? {}) as { term?: unknown; plain?: unknown };
      return { term: str(o.term), plain: str(o.plain) };
    })
    .filter(
      (t) =>
        t.term.length > 1 &&
        t.term.length <= 30 &&
        t.plain.length > 0 &&
        // "알아야 할 말"만 남긴다 — 구현 부품 이름은 그냥 모르는 말이다.
        !isInternalPartName(t.term),
    );
  const terms = rawTerms.filter((t) => guideText.includes(t.term)).slice(0, 8);
  termsProposed = rawTerms.length;
  termsDropped = rawTerms
    .filter((t) => !guideText.includes(t.term))
    .map((t) => t.term)
    .slice(0, 6);

  /**
   * 말투 — 전부 "~해요" 로 쓴다. "~합니다" 가 섞이면 한 카드에 두 화자가 생긴다.
   * 프롬프트로만 부탁했을 때 5건 중 1건이 어겼다. 게이트에 걸리면 다시 물어보니 값이 싸다.
   * ⚠️ 리드는 검사하지 않는다 — 원문 인용이 섞일 수 있어 오탐이 난다. 칸 안만 본다.
   */
  const formal = sections.find((s) =>
    [s.problem, ...s.paras, s.outcome].some((x) => /합니다|습니다/.test(x ?? "")),
  );
  if (formal) return { ok: false, reason: `말투가 섞임(~습니다): ${formal.question}` };

  const summary = str(parsed.summary).slice(0, 200);
  if (summary.length < 10) return { ok: false, reason: "요약 문장이 없음" };

  // ⑥ 기획 포인트 — **없으면 없는 대로 둔다.** 지어낸 교훈을 실으면 서비스를 못 믿게 된다.
  //    실측에서 걸러야 했던 두 가지를 같이 막는다:
  //      · "~사례를 참고하면 ~을 이해할 수 있습니다" — 글을 읽으라는 말의 반복이다.
  //      · soWhat 을 바꿔 쓴 문장 — 바로 위 칸에 이미 있는 말이라 한 칸을 버리는 셈이다.
  let plannerPoint = dedupeSentences(stripBlockRefs(str(parsed.plannerPoint))).slice(0, 400);
  if (plannerPoint.length < 20) plannerPoint = "";
  if (plannerPoint && /참고하(면|여|고)|이해할 수 있|도움이 (될|됩)|알 수 있습니다/.test(plannerPoint)) {
    plannerPoint = "";
  }
  if (plannerPoint && overlapRatio(plannerPoint, lead.soWhat) > 0.6) plannerPoint = "";
  if (plannerPoint && numberTokens(plannerPoint).some((n) => !bodyFlat.includes(n.replace(/\s+/g, "")))) {
    plannerPoint = "";
  }

  return { ok: true, guide: { summary, terms, lead, plannerPoint, sections } };
}

/**
 * 2단계 — **원문 전문을 읽고** 소제목의 답을 다시 쓴다.
 *
 * 1단계는 블록마다 **앞 140자**만 보고 쓴다(입력을 작게 유지해야 분당 한도를 안 넘는다).
 * 실측: 본문 11,428자 · 블록 48개 · 평균 237자 → 모델이 보는 건 본문의 44%,
 * 그나마 **문단 중반부터는 통째로 안 보인다.**
 * "무슨 일 / 왜 / 그래서"는 앞머리만 봐도 답이 되지만, 소제목의 답은 문단 중반의
 * 설명·수치·판단 근거가 재료라 1단계에서는 나올 수가 없었다("좀 더 상세한 내용을 못 긁는다").
 *
 * 그래서 1단계가 고른 **근거 블록의 전문만** 모아 한 번 더 부른다.
 * 블록을 이미 골라 놨으니 보낼 양이 작다(3~6덩어리 ≈ 1,500자). 글당 3,400 → 약 7,000토큰.
 * 가이드는 글에 한 번만 만들어 **모두가 같은 저장본을 읽으므로**, 이 비용은 글당 1회다.
 *
 * ⚠️ 실패하면 **1단계 답을 그대로 둔다.** 얕아도 있는 게, 통째로 없는 것보다 낫다.
 */
const DEEP_SYS = `너는 기술 블로그 글을 **개발을 전혀 모르는 사람**(기획자·디자이너·마케터)에게
풀어 주는 한국어 편집자다. 아래 "원문 발췌"만 읽고 질문마다 답을 쓴다.
반드시 아래 JSON 하나만 출력해라(설명·코드펜스 금지).
{"answers":[{"n":1,"problem":"","paras":["",""],"outcome":""}],"terms":[{"term":"","plain":""}]}

1) n: 질문 번호. 준 질문을 **전부** 답한다(빠뜨리지 마라).
1-1) problem: 이 칸이 다루는 **문제** 한 문장. 무엇이 안 되고 있었는지.
   해결책을 여기 쓰지 마라 — 해결은 아래 paras 가 맡는다.

2) paras: **어떻게 풀었는지.** 2~3개, 각 1~2문장, 각 220자 이내, 존댓말(~해요).
   · 문제는 위 problem 이 맡았으니 여기는 **해결만** 담는다.
   · **문단 하나 = 사실 하나.** 앞 문단을 다시 풀어 쓴 문단은 쓰지 마라. 서로 다른 것을 말해야 한다.
   · 문단마다 발췌에 있는 **구체적인 것**을 하나는 담는다. 담을 게 없으면 그 문단은 빼라.
     구체적인 것 = **숫자·기간·비교 대상·사용자가 겪은 일·팀이 내린 선택**.
   · ⚠️ **옵션·속성·API 이름은 쓰지 마라.** 부품 이름(Quantity Picker, Dialog)까지는 괜찮지만,
     그 부품의 **설정값**을 나열하는 순간 개발 문서가 된다. 읽는 사람은 그걸 쓸 일이 없다.
     이런 말 대신 **우리말로 풀어 쓴다**(뜻을 빼지 말고 표현만 바꾼다):
       minuteStep → 분 단위 간격 · locale → 언어·지역 설정 · props → 설정값 ·
       비활성 상태 → 선택할 수 없는 상태 · 팝오버 → 떠 있는 작은 창 · 패딩 → 여백 ·
       네이티브 폼 → 웹 기본 양식 · 렌더링 → 화면에 그리기 · 푸터 → 아래쪽 영역
     Portal · input · Date 객체처럼 **바꿔 쓸 말이 없으면 그 얘기 자체를 빼라**
     (읽는 사람이 쓸 일이 없는 내용이다). 부품 이름(Quantity Picker, Dialog)은 그대로 써도 된다.
     **그게 사용자에게 무엇을 해 주는지**로 바꿔 쓴다.
       (설정값 이름을 그대로 쓰지 말고, 그 설정이 **사용자에게 해 주는 일**로 바꿔 쓴다.)
     ⚠️ 위 목록은 **바꿔 쓸 말의 사전**이다. 예시 문장을 그대로 베껴 쓰지 마라 —
        이 글에 없는 내용을 쓰면 거짓이 된다.   · ⚠️ **말투를 섞지 마라.** 문단·결말 **전부 "~해요"** 로 끝낸다.
     "~합니다", "~할 수 있습니다" 를 쓰지 마라. 한 카드 안에서 말투가 갈리면 따로 쓴 글처럼 읽힌다.
   · 2개로 끝내지 마라. 발췌에 근거가 남아 있는 한 3개까지 쓴다.
   · ⚠️ **개수만 말하고 넘어가지 마라.** "여섯 가지를 추가했어요"라고 썼으면
     **그 여섯이 무엇인지 그 자리에서 이름을 적는다.** 발췌에 이름이 있는데 안 적으면,
     읽는 사람은 "그래서 뭘 만들었다는 거지?" 하고 다시 원문을 찾아가야 한다(실제로 받은 지적).
   · 이런 문장은 쓰지 마라(아무것도 말하지 않는다):
     "~때문이에요"로만 끝나는 되풀이 · "추가적인 절차가 필요합니다" · "~라고 볼 수 있어요" ·
     "중요한 역할을 합니다" · 발췌에 없는 일반론.
2-1) outcome: **그래서 이건 어떻게 됐어요?** 이 질문 하나의 결말을 한 문장으로.
   위 paras 가 "문제 → 해결"까지 왔으니, 여기는 **그 해결로 무엇이 달라졌는지**다.
   해결 방법을 다시 쓰지 마라 — 그건 이미 위에 있다. 발췌에 결과가 없으면 빈 문자열로 둔다.
2-2) terms: **네가 방금 쓴 문장 안에서** 최대 6개 고른다. 기준은 하나다 —
   **"이 말을 모르면 내가 쓴 이 문장을 이해할 수 없는가?"**
   · 판별: 그 말을 지우고 읽어 보라. 뜻이 통하면 넣지 마라. 문장이 막히면 넣어라.
   · 회의에서 그 말을 쓸 일이 있는지는 묻지 마라 — 기준은 쓸모가 아니라 **이해**다.
   · 넣을 것: 기술 개념, 영어 약어(UT·PoC), 한국어인데 뜻이 다른 말(적재·정산·정합성).
   · 빼야 할 것: 누구나 아는 말 · **구현 부품 이름**(Worker Step·PartitionHandler) —
     지우고 읽어도 뜻이 그대로다.
   · **네가 쓴 표기 그대로** 적는다. 다르게 적으면 그 말에 밑줄이 안 그어져 아무 일도 안 한다.
   · plain 은 50자 이내로 쉽게. 누구나 아는 말(UI, 화면, 사용자)은 넣지 마라.

3) **발췌에 있는 내용만** 쓴다. 발췌에 없으면 지어내지 말고 그 질문은 짧게 답한다.
4) 구현 과정을 나열하지 마라. 기술 이름이 나오면 **그게 무엇을 해결했는지**로 바꿔 써라.
5) 숫자·고유명사는 발췌에 있는 것만. 블록 번호를 문장에 쓰지 마라.
6) 발췌 문장을 그대로 복사하지 말고 네 말로 다시 써라.`;

async function deepenSections(
  guide: Record<string, unknown>,
  blocks: { items: { seg: string }[] }[],
  body: string,
  only?: string,
): Promise<{ changed: number; reason?: string; sample?: string }> {
  const sections = (guide.sections ?? []) as {
    question: string;
    problem: string;
    paras: string[];
    outcome: string;
    blocks: number[];
  }[];
  if (sections.length === 0) return { changed: 0, reason: "소제목 없음" };

  const full = (i: number) =>
    (blocks[i]?.items.map((x) => x.seg).join("") ?? "").replace(/\s+/g, " ").trim();

  // 보낼 발췌 — 소제목들이 가리킨 블록의 **전문**. 같은 블록을 두 번 넣지 않는다.
  // 3,500자에서 끊는다: 입력 ≈ 2,200토큰 + 출력 2,000 → 분당 한도 8,000 안에 든다.
  const seen = new Set<number>();
  const chunks: string[] = [];
  let used = 0;
  for (const s of sections) {
    for (const b of s.blocks) {
      if (seen.has(b)) continue;
      const text = full(b);
      if (!text) continue;
      if (used + text.length > 4200) continue;
      seen.add(b);
      used += text.length;
      chunks.push(`[${b}] ${text}`);
    }
  }
  if (chunks.length === 0) return { changed: 0, reason: "근거 블록 전문을 못 찾음" };

  const questions = sections.map((s, i) => `${i + 1}) ${s.question}`).join("\n");
  const input = `질문:\n${questions}\n\n원문 발췌:\n${chunks.join("\n\n")}`;

  // 칸이 3~5개 × 문단 3~4개 + 결말이라 2,000 토큰으로는 잘린다.
  const raw = await llmSummarize(input, DEEP_SYS, 3000, only);
  if (!raw) return { changed: 0, reason: `2단계 LLM 실패 — ${(lastLlmError ?? "").slice(0, 60)}` };
  const parsed = parseJsonLoose(raw) as { answers?: unknown; terms?: unknown } | null;
  if (!parsed || !Array.isArray(parsed.answers)) {
    // 원문 머리를 같이 돌려준다 — 무엇이 달라서 못 읽었는지는 그걸 봐야 안다.
    return {
      changed: 0,
      reason: parsed ? "2단계 answers 배열 없음" : "2단계 JSON 파싱 실패",
      sample: raw.slice(0, 300),
    };
  }

  const bodyFlat = body.replace(/\s+/g, "");
  let changed = 0;
  for (const a of parsed.answers) {
    const o = (a ?? {}) as { n?: unknown; paras?: unknown };
    const idx = Math.floor(Number(o.n)) - 1;
    if (!Number.isFinite(idx) || idx < 0 || idx >= sections.length) continue;
    const problem2 = stripBlockRefs(str(o.problem)).slice(0, 300);
    const raw2 = (Array.isArray(o.paras) ? o.paras : [])
      .map((x) => stripBlockRefs(str(x)))
      .filter((x) => x.length > 0 && x.length <= 400);
    // 앞 문단을 바꿔 쓴 문단은 버린다 — 1단계 게이트와 같은 잣대다.
    const paras: string[] = [];
    for (const para of raw2) {
      if (paras.some((k) => overlapRatio(para, k) > 0.55)) continue;
      paras.push(para);
      if (paras.length >= 5) break;
    }
    if (paras.length < 2) continue; // 1단계보다 얕아지면 바꿀 이유가 없다
    if (problem2.length >= 10 && !numberTokens(problem2).some((n) => !bodyFlat.includes(n.replace(/\s+/g, "")))) {
      sections[idx].problem = problem2;
    }
    const outcome = stripBlockRefs(str(o.outcome)).slice(0, 300);
    // 숫자 대조 — 지어낸 수치가 있으면 그 칸만 1단계 답을 지킨다.
    const bad = paras.some((line) =>
      numberTokens(line).some((n) => !bodyFlat.includes(n.replace(/\s+/g, ""))),
    );
    if (bad) continue;
    sections[idx].paras = paras;
    // 결말은 **있을 때만** 갈아끼운다. 2단계가 비워 보냈다고 1단계 결말까지 지우지 않는다.
    const dupOutcome = paras.some((para) => overlapRatio(outcome, para) > 0.55);
    if (
      outcome.length >= 10 &&
      !dupOutcome &&
      !numberTokens(outcome).some((n) => !bodyFlat.includes(n.replace(/\s+/g, "")))
    ) {
      sections[idx].outcome = outcome;
    }
    changed++;
  }
  /**
   * 2단계가 고른 용어를 합친다.
   *
   * 1단계는 **블록 앞 140자**만 보고 용어를 고른다. 그래서 정작 본문을 읽고 쓴 말
   * (`Quantity Picker`, `Figma Make`)이 용어 목록에 없었다 — 실측에서 0~4개로 들쭉날쭉했다.
   * 2단계는 자기가 쓴 문장을 아니까 거기서 받는 게 맞다.
   * 지어냄 방어는 그대로 — 아래 `guideArticle` 이 **최종 문장에 실제로 나오는지** 다시 맞춘다.
   */
  const extra = (Array.isArray(parsed.terms) ? parsed.terms : [])
    .map((x) => {
      const o = (x ?? {}) as { term?: unknown; plain?: unknown };
      return { term: str(o.term), plain: str(o.plain) };
    })
    .filter(
      (x) =>
        x.term.length > 1 && x.term.length <= 30 && x.plain.length > 0 && !isInternalPartName(x.term),
    );
  if (extra.length > 0) {
    const cur = (guide.terms ?? []) as { term: string; plain: string }[];
    const seen = new Set(cur.map((x) => x.term));
    for (const one of extra) {
      if (seen.has(one.term)) continue;
      seen.add(one.term);
      cur.push(one);
    }
    guide.terms = cur.slice(0, 8);
  }

  return { changed, reason: changed === 0 ? "쓸 만한 답이 없음" : undefined };
}

async function guideArticle(articleId: string, only?: string) {
  const supabase = serviceClient();
  const { data: art } = await supabase
    .from("articles")
    .select("id, title, body, url")
    .eq("id", articleId)
    .single();
  if (!art) return { ok: false, reason: "글 없음" };

  let body: string = cleanBody(art.body ?? "");
  if (!body) {
    const html = await fetchHtml(art.url);
    if (html) body = cleanBody(stripFooter(extractArticle(html).text ?? ""));
  }
  if (body.length < 400) return { ok: false, reason: "본문이 너무 짧음" };

  const blocks = bodyBlocks(body);
  if (blocks.length < 4) return { ok: false, reason: "덩어리가 4개 미만" };

  /**
   * 입력을 **작게** 유지한다. Groq 무료 티어는 분당 8,000 토큰이라
   * (입력 + 출력)이 그 선을 넘으면 매번 429 가 나고, 재시도해도 계속 걸린다.
   * 실제로 블록 200자 × 12,000자 + 출력 3,000 토큰으로 보냈다가 전부 "LLM 호출 실패"였다.
   * 단계를 나누는 데에는 각 덩어리가 "무슨 얘기로 시작하는지"면 충분하다.
   */
  // 블록마다 140자. 110자로는 모델이 그 문단이 무슨 얘긴지 가늠하지 못해
  // 엉뚱한 번호를 근거로 달았다. 대신 전체 길이는 5,000자로 묶어 TPM 안에 둔다.
  const listing = numberedBlocks(blocks, 140).slice(0, 5000);
  const input = `제목: ${art.title}

번호 매긴 본문(블록 ${blocks.length}개):
${listing}`;
  /**
   * 출력도 조인다 — 잘려도 repairJson 이 앞부분을 살려낸다.
   * JSON 이 깨지면 **한 번 더 물어본다.** 같은 입력에도 모델 출력은 매번 다르고,
   * 실측상 첫 시도가 깨져도 두 번째는 멀쩡한 경우가 잦았다. 세 번은 안 한다 —
   * 두 번 연속 깨지면 그 글은 입력이 문제라 더 해봐야 토큰만 쓴다.
   */
  let parsed: Record<string, unknown> | null = null;
  let sample = "";
  for (let attempt = 0; attempt < 3 && !parsed; attempt++) {
    // v2(한 줄 × 5)보다 출력이 길다 — 리드 3칸 + 소제목마다 문단 2~3개.
    // Groq 무료 티어 분당 8,000 토큰 안에 들어가야 하므로 입력을 줄이고 출력을 늘렸다.
    // 칸 최대 6개 + **길이 제한을 푼 리드 4칸**. 2,600 으로는 리드에서 이미 잘렸다.
    const raw = await llmSummarize(input, GUIDE_SYS, 3400, only);
    if (!raw) {
      // 이유를 화면까지 실어 보낸다. "LLM 호출 실패"만으로는 키 문제인지 레이트리밋인지 모른다.
      // 80자로 자르면 TPM(분당)인지 TPD(하루)인지가 잘려서 안 보인다 — 그 둘은 대처가 완전히 다르다.
      return { ok: false, reason: `LLM 호출 실패 — ${(lastLlmError ?? "").slice(0, 300)}` };
    }
    sample = raw.slice(0, 200);
    parsed = parseJsonLoose(raw);
  }
  if (!parsed) return { ok: false, reason: `JSON 파싱 실패 — ${sample.slice(0, 60)}` };

  // 근거로 쓸 수 있는 덩어리인가 — 소제목이 아니고, 한 문장은 되는 것.
  const usableBlock = (i: number) => {
    const b = blocks[i];
    if (!b || b.kind === "heading") return false;
    return b.items.map((x) => x.seg).join("").trim().length >= 25;
  };
  /**
   * 게이트에 걸려도 **한 번 더 물어본다.**
   *
   * 실측(5건 감사): 5건 중 1건이 `무슨 일인지가 비었음` 으로 탈락했다. 같은 입력에도
   * 모델 출력은 매번 다르고, 재시도하면 대개 통과한다. 예전엔 여기서 바로 포기해서
   * **그 글은 크론이 돌 때마다 같은 자리에서 실패**했다 — 토큰만 쓰고 요약은 영영 없었다.
   * 실패한 시도는 3,400토큰쯤이라, 20% 확률에 재시도 한 번은 평균 700토큰이다. 값이 싸다.
   */
  let gated = gateGuide(parsed as Record<string, unknown>, blocks.length, body, usableBlock);
  for (let retry = 0; retry < 2 && (!gated.ok || !gated.guide); retry++) {
    console.error(`[summarize] 게이트 탈락(${gated.reason}) — 다시 물어본다`);
    const again = await llmSummarize(input, GUIDE_SYS, 3400, only);
    const reparsed = again ? parseJsonLoose(again) : null;
    if (!reparsed) continue;
    gated = gateGuide(reparsed as Record<string, unknown>, blocks.length, body, usableBlock);
  }
  if (!gated.ok || !gated.guide) {
    // 어느 모델이 쓴 결과가 떨어졌는지 같이 남긴다 — 제공자가 둘이면 그게 첫 단서다.
    return { ok: false, reason: `${gated.reason ?? "게이트 탈락"} [${lastLlmUsed ?? "?"}]`, sample };
  }

  // 2단계 — 고른 블록의 **전문**을 읽고 소제목의 답을 다시 쓴다.
  // 실패해도 1단계 결과는 그대로 저장한다(얕아도 있는 게 낫다).
  const deep = await deepenSections(gated.guide, blocks, body, only);

  /**
   * 용어를 **여기서 다시 거른다.**
   *
   * 게이트는 "가이드에 나오는 말만" 용어로 남긴다. 그런데 게이트가 도는 시점의 가이드는
   * **1단계 뼈대**(칸마다 문단 하나)뿐이다. `Quantity Picker`·`Bottom Sheet` 같은 말은
   * 2단계가 나중에 쓴 문단에 등장하므로, 검사할 때는 아직 없었다 —
   * 그래서 용어가 8개 제안돼도 1개만 살아남았다(실측). 순서가 거꾸로였다.
   * 최종 문장이 다 모인 지금 다시 맞춰 본다.
   */
  const finalGuide = gated.guide as Record<string, unknown>;
  const finalLead = finalGuide.lead as Record<string, string>;
  const finalSections = (finalGuide.sections ?? []) as {
    question: string;
    problem: string;
    paras: string[];
    outcome: string;
  }[];
  const finalText = [
    finalLead.what,
    finalLead.why,
    finalLead.how,
    finalLead.soWhat,
    str(finalGuide.plannerPoint),
    ...finalSections.flatMap((s) => [s.question, s.problem, ...s.paras, s.outcome]),
  ].join(" ");
  const keptTerms = (finalGuide.terms as { term: string; plain: string }[]).filter((x) =>
    finalText.includes(x.term),
  );
  // 1단계 기준으로 이미 버려진 용어는 되살릴 수 없다 — 남은 것 중에서만 다시 맞춘다.
  finalGuide.terms = keptTerms;

  await supabase.from("articles").update({ reading_guide: gated.guide }).eq("id", articleId);
  const g = gated.guide as unknown as { sections: unknown[]; terms: unknown[] };
  return {
    ok: true,
    model: lastLlmUsed,
    // 성공했어도 **그 전에 무엇이 실패했는지**는 남긴다 — 폴백이 도는지 확인하는 유일한 창이다.
    tried: llmTried,
    sections: g.sections.length,
    terms: g.terms.length,
    deepened: deep.changed,
    deepReason: deep.reason,
    deepSample: deep.sample,
    termsProposed,
    termsDropped,
  };
}

/**
 * 밑줄 친 문장으로 **질문의 답 초안**을 쓴다.
 *
 * ⚠️ 글 전체를 요약시키지 않는다. 재료는 **이 사람이 직접 밑줄 친 문장**뿐이다.
 *    그래야 나오는 초안이 "글의 요약"이 아니라 "이 사람이 이 글에서 본 것"이 되고,
 *    남의 요약과 달리 고칠 마음이 생긴다. 재료가 짧아 토큰도 거의 안 든다.
 * ⚠️ 저장하지 않는다. 초안은 사람이 고쳐서 저장하는 것이지 AI 가 남기는 글이 아니다.
 */
const DRAFT_SYS =
  "당신은 글을 읽고 메모한 사람의 말투로 초안을 대신 써 주는 도우미입니다.\n" +
  "규칙:\n" +
  "1) 주어진 밑줄 문장에 **실제로 있는 내용만** 쓴다. 없는 사실을 지어내지 않는다.\n" +
  "2) 질문에 대한 답으로 2~3문장, 한국어로 담백하게(~다/~였다).\n" +
  "3) 3인칭 요약투(이 글은, 저자는) 금지. 내가 메모하듯 쓴다.\n" +
  "4) 밑줄만으로 답할 수 없으면 빈 문자열을 반환한다.";

async function draftAnswer(question: string, source: string): Promise<string> {
  const q = question.trim();
  const src = source.trim().slice(0, 2000);
  if (!q || !src) return "";
  // 모델 폴백까지 쓰는 공용 래퍼 — 한 모델이 429 면 다음 모델로 넘어간다.
  const prompt = "질문: " + q + "\n\n내가 밑줄 친 문장:\n" + src;
  const out = await llmSummarize(prompt, DRAFT_SYS, 500);
  return (out ?? "").trim();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      share_id,
      article_id,
      discussion_id,
      word_id,
      target,
      mode,
      job_role,
      debug,
      dry,
      chars,
      tokens,
      provider,
      question,
      source,
    } = (await req.json()) as Payload;
    const m: Mode =
      mode === "planner" || mode === "explain" || mode === "insight" ? mode : "plain";

    /**
     * 진단용. `{debug:true}` 는 작은 요청으로 모델 접근만 본다.
     * `{debug:true, chars:4000, tokens:1200}` 는 **실제 크기**로 한 번 던져서
     * 429 전문을 그대로 돌려준다 — "분당 한도가 얼마고 이 요청이 얼마인지"를 봐야
     * 기다려서 될 일인지, 요청을 줄여야 할 일인지 판단할 수 있다.
     */
    if (debug) {
      const size = Number((await Promise.resolve(chars)) ?? 0);
      const probe = size > 0 ? "가".repeat(size) : "한 줄로 '테스트'라고만 답하세요.";
      const maxT = Number(tokens ?? 0) || 40;
      // ⚠️ 예전엔 여기서 LLM_MODELS·callGroq 를 불렀는데, 제공자 체인으로 바꾸면서
      //    그 둘이 사라졌다. 이 분기는 debug 를 줄 때만 도는 죽은 길이라 한동안 몰랐다.
      lastLlmLimits = {};
      const results: Record<string, string> = {};
      for (const prov of LLM_PROVIDERS) {
        const hasKey = Boolean(Deno.env.get(prov.envKey));
        for (const model of prov.models) {
          const tag = `${prov.name}/${model}`;
          if (!hasKey) {
            results[tag] = `NO_KEY(${prov.envKey})`;
            continue;
          }
          lastLlmError = null;
          const out = await callLlm(prov, probe, "간단히 답하는 도우미.", model, maxT);
          results[tag] = out ? `OK: ${out.slice(0, 40)}` : (lastLlmError ?? "null");
        }
      }
      return json({ ok: true, chars: size, results, limits: lastLlmLimits });
    }

    if (target === "draft") {
      const draft = await draftAnswer(question ?? "", source ?? "");
      return json({ ok: true, target: "draft", draft });
    }
    if (word_id) {
      // mode:"easy" = 2단("더 쉽게") — 1단으로 부족했던 사람에게 직무 언어 + 비유로 다시 쓴다.
      if (mode === "easy") {
        const easy_definition = await explainWordEasier(word_id);
        return json({ ok: true, easy_definition });
      }
      const definition = await defineWord(word_id);
      return json({ ok: true, definition });
    }
    if (share_id) {
      const summary = await summarizeShare(share_id, m);
      return json({ ok: true, mode: m, summary });
    }
    /**
     * 쓸 수 있는 모델 이름 확인 — LLM 을 부르지 않으므로 **토큰이 안 든다**.
     * 모델 이름은 제공자가 조용히 폐기한다(실측: gemini-2.5-flash 가 404 "no longer available").
     * 그때 체인이 통째로 말을 안 듣는데, 목록을 못 보면 이름을 추측하게 된다.
     *   호출: { "target": "models" }
     */
    if (target === "models") {
      const key = Deno.env.get("GEMINI_API_KEY");
      if (!key) return json({ ok: false, reason: "GEMINI_API_KEY 없음" });
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${key}&pageSize=200`,
      );
      const data = await res.json();
      const names = (data?.models ?? [])
        .filter((mm: { supportedGenerationMethods?: string[] }) =>
          (mm.supportedGenerationMethods ?? []).includes("generateContent"),
        )
        .map((mm: { name?: string }) => (mm.name ?? "").replace("models/", ""));
      return json({ ok: res.ok, count: names.length, models: names });
    }

    if (article_id) {
      if (target === "enrich") {
        const result = await enrichArticle(article_id);
        return json({ ...result, target: "enrich" });
      }
      if (target === "guide") {
        // provider 를 주면 그 제공자만 쓴다(확인용). 평소엔 안 준다 → 폴백 체인 그대로.
        const result = await guideArticle(article_id, typeof provider === "string" ? provider : undefined);
        return json({ ...result, target: "guide" });
      }
      if (target === "verify") {
        const result = await verifyEvidence(article_id);
        return json({ ...result, target: "verify" });
      }
      if (target === "classify") {
        const result = await classifyArticle(article_id, dry === true);
        return json({ ...result, target: "classify" });
      }
      const summary = await summarizeArticle(article_id, m, job_role);
      return json({ ok: true, mode: m, summary });
    }
    if (discussion_id) {
      if (target === "result") {
        const ai_summary = await summarizeDiscussionResult(discussion_id);
        return json({ ok: true, target: "result", ai_summary });
      }
      const summary = await summarizeDiscussionContent(discussion_id, m);
      return json({ ok: true, target: "content", mode: m, summary });
    }
    return json({ error: "share_id 또는 discussion_id 필수" }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
