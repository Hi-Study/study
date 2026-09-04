// summarize — 공유 글/토론을 무료 LLM 으로 요약해 캐시.
//   · { share_id, mode }                  → 공유 본문 요약(모드별) → shares.ai_summaries[mode]
//   · { discussion_id, target:"content", mode } → 토론 주제+여는 글 요약(모드별) → discussions.ai_summaries[mode]
//   · { discussion_id, target:"result" }  → 토론 결과(의견+결론) 요약 → discussions.ai_summary
//   · { word_id }                        → 단어 1단 뜻풀이 → user_words.definition
//   · { word_id, mode:"easy" }           → 단어 2단("더 쉽게") → user_words.easy_definition
//   · { article_id, target:"enrich" }    → 결정 카드 · 질문 · 난이도 · 용어 → articles.*
//   · { target:"draft", question, source } → 내가 밑줄 친 문장으로 **질문의 답 초안** (저장 없음)
//
// mode: plain(원문 요약) | planner(기획자 관점) | explain(쉽게 풀기)
// 배포: supabase functions deploy summarize --use-api
// 키:   supabase secrets set LLM_API_KEY=gsk_...(Groq)
import { corsHeaders, json } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { extractArticle, fetchHtml, stripFooter } from "../_shared/extract.ts";

type Mode = "plain" | "planner" | "explain" | "insight";

interface Payload {
  share_id?: string;
  article_id?: string;
  discussion_id?: string;
  word_id?: string;
  target?: "content" | "result" | "enrich" | "draft";
  /** draft 전용 — 답을 써야 할 질문. */
  question?: string;
  /** draft 전용 — 내가 밑줄 친 문장(+메모) 목록. 본문은 보내지 않는다. */
  source?: string;
  /** 읽는 사람 직무 — insight 모드의 세 번째 항목을 이 관점으로 쓴다. */
  job_role?: string | null;
  /** easy 는 본문 요약 모드가 아니라 **단어 뜻풀이 2단 전용**이라 Mode 에 넣지 않는다. */
  mode?: Mode | "easy";
  debug?: boolean;
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

// Groq(OpenAI 호환) 요약.
// Groq 모델 폴백 체인 — 앞에서부터 시도해 첫 성공을 사용(모델 폐기에 견고).
// 이 키로 실측 확인: gpt-oss 계열만 접근 가능(llama 계열은 model_not_found). 120b 우선, 20b 폴백.
const LLM_MODELS = [
  "openai/gpt-oss-120b",
  "openai/gpt-oss-20b",
];

let lastLlmError: string | null = null;

async function callGroq(
  text: string,
  system: string,
  model: string,
  maxTokens = 900,
): Promise<string | null> {
  const apiKey = Deno.env.get("LLM_API_KEY");
  if (!apiKey) {
    lastLlmError = "NO_LLM_API_KEY";
    return null;
  }
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: text.slice(0, 24000) },
        ],
      }),
    });
    if (!res.ok) {
      lastLlmError = `[${model}] HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`;
      return null;
    }
    const data = await res.json();
    const out = data?.choices?.[0]?.message?.content?.trim() ?? null;
    if (!out) lastLlmError = `[${model}] EMPTY_CONTENT`;
    return out;
  } catch (e) {
    lastLlmError = `[${model}] EXC: ${e instanceof Error ? e.message : String(e)}`;
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
  const m = (err ?? "").match(/try again in ([\d.]+)s/i);
  if (!m) return 0;
  return Math.min(Math.ceil(parseFloat(m[1]) * 1000) + 1000, 30000); // 여유 1초, 최대 30초
}

async function llmSummarize(
  text: string,
  system: string,
  maxTokens = 900,
): Promise<string | null> {
  // 모델 체인을 최대 3회 시도(레이트리밋 429 시 응답이 알려준 만큼 대기 후 재시도).
  for (let attempt = 0; attempt < 3; attempt++) {
    for (const model of LLM_MODELS) {
      const out = await callGroq(text, system, model, maxTokens);
      if (out) return out;
      console.error("[summarize] model fail:", lastLlmError);
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
const ENRICH_SYS =
  "너는 기술·기획 아티클을 읽고 구조화하는 한국어 분석기다. 반드시 아래 JSON 하나만 출력해라" +
  "(설명·코드펜스 금지).\n" +
  '{"decision":{"problem":"","constraint":"","chosen":"","rejected":"","metric":""},' +
  '"questions":{"insight":"","apply":""},' +
  '"level":"easy|terms|code","terms":[{"term":"","plain":"","why":"","domain":""}]}\n' +
  "규칙:\n" +
  "1) decision 은 **본문에 실제로 쓰인 내용만** 채운다. 특히 rejected(버린 대안)는 글이 " +
  "명시적으로 'A 대신 B' 또는 'A는 ~해서 안 썼다'라고 말한 경우에만 채우고, 아니면 빈 문자열로 둬라. " +
  "추측해서 채우지 마라. 회고·문화·인터뷰 글이면 decision 의 모든 값을 빈 문자열로 둬라.\n" +
  "2) metric 은 **숫자와 단위가 함께 있는 결과**만 쓴다(예: '실패율 2.1%→0.4%', '응답 300ms 단축'). " +
  "숫자만 덩그러니 있거나 결과가 아니면 빈 문자열로 둬라.\n" +
  "2-1) chosen 과 rejected 는 **서로 비교 가능한 짧은 명사구**(각 20자 이내)로 쓴다. " +
  "예: chosen='단일 테이블', rejected='테이블 분리'. " +
  "'~하지 않음', '~를 만들지 않음' 같은 부정 서술이나 문장은 쓰지 마라. " +
  "둘이 같은 대상을 가리키게 되면 rejected 를 빈 문자열로 둬라.\n" +
  "3) level: easy=배경지식 없이 읽힘, terms=도메인 용어가 나옴, code=코드/아키텍처 상세가 있음.\n" +
  "4) terms 는 비전공자가 막힐 용어만 **최대 4개**. plain 은 한 문장, why 는 반 문장으로 짧게. " +
  "domain 은 dev|infra|data|design|marketing|product|biz 중 하나.\n" +
  "5) questions 는 이 글을 다 읽은 사람이 **답을 쓸 수 있는 질문** 2개다.\n" +
  "   · insight: 이 글이 내린 **판단·트레이드오프**를 파고드는 질문.\n" +
  "   · apply: 읽는 사람의 **자기 일**로 옮기게 하는 질문. '우리'가 들어가야 한다.\n" +
  "   두 질문 모두 아래를 지켜라.\n" +
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
function parseJsonLoose(raw: string): Record<string, unknown> | null {
  const t = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = t.indexOf("{");
  const end = t.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  try {
    return JSON.parse(t.slice(start, end + 1)) as Record<string, unknown>;
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
    metric: str(d.metric),
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
      level,
      terms,
      read_minutes: readMinutes(body),
    })
    .eq("id", articleId);

  return { ok: true, hasDecision, question, applyQuestion, level, terms: terms.length };
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
      question,
      source,
    } = (await req.json()) as Payload;
    const m: Mode =
      mode === "planner" || mode === "explain" || mode === "insight" ? mode : "plain";

    // 진단용: 후보 모델별 성패를 그대로 반환(임시).
    if (debug) {
      const results: Record<string, string> = {};
      for (const model of LLM_MODELS) {
        const out = await callGroq("한 줄로 '테스트'라고만 답하세요.", "간단히 답하는 도우미.", model);
        results[model] = out ? `OK: ${out.slice(0, 40)}` : (lastLlmError ?? "null");
      }
      return json({ ok: true, hasKey: Boolean(Deno.env.get("LLM_API_KEY")), results });
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
    if (article_id) {
      if (target === "enrich") {
        const result = await enrichArticle(article_id);
        return json({ ...result, target: "enrich" });
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
