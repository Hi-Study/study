// summarize — 공유 글/토론을 무료 LLM 으로 요약해 캐시.
//   · { share_id, mode }                  → 공유 본문 요약(모드별) → shares.ai_summaries[mode]
//   · { discussion_id, target:"content", mode } → 토론 주제+여는 글 요약(모드별) → discussions.ai_summaries[mode]
//   · { discussion_id, target:"result" }  → 토론 결과(의견+결론) 요약 → discussions.ai_summary
//
// mode: plain(원문 요약) | planner(기획자 관점) | explain(쉽게 풀기)
// 배포: supabase functions deploy summarize --use-api
// 키:   supabase secrets set LLM_API_KEY=gsk_...(Groq)
import { corsHeaders, json } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { extractArticle, fetchHtml, stripFooter } from "../_shared/extract.ts";

type Mode = "plain" | "planner" | "explain";

interface Payload {
  share_id?: string;
  article_id?: string;
  discussion_id?: string;
  word_id?: string;
  target?: "content" | "result";
  mode?: Mode;
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
};

const RESULT_SYS =
  "너는 토론을 정리하는 한국어 요약가다. 주제, 주요 의견들의 쟁점, 그리고 (있다면) 방장이 고정한 결론을 " +
  "중심으로 4~6문장으로 정리해라. 어떤 의견들이 오갔고 무엇으로 모였는지 드러나게. 존댓말, 문단으로.";

// Groq(OpenAI 호환) 요약.
async function llmSummarize(text: string, system: string): Promise<string | null> {
  const apiKey = Deno.env.get("LLM_API_KEY");
  if (!apiKey) return null;
  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        max_tokens: 900,
        messages: [
          { role: "system", content: system },
          { role: "user", content: text.slice(0, 24000) },
        ],
      }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.choices?.[0]?.message?.content?.trim() ?? null;
  } catch {
    return null;
  }
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
      const extracted = extractArticle(await fetchHtml(share.url));
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

// distill 아티클 요약(모드별) → articles.ai_summaries[mode] 캐시.
async function summarizeArticle(articleId: string, mode: Mode): Promise<string> {
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
      text = extractArticle(await fetchHtml(art.url)).text ?? "";
    } catch {
      text = "";
    }
  }
  const fallback = [art.title, art.summary].filter(Boolean).join(" — ") || art.title;
  const summary = (text ? await llmSummarize(text, CONTENT_SYS[mode]) : null) ?? fallback;

  const merged = { ...(art.ai_summaries ?? {}), [mode]: summary };
  await supabase.from("articles").update({ ai_summaries: merged }).eq("id", articleId);
  return summary;
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
      const extracted = extractArticle(await fetchHtml(disc.url));
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { share_id, article_id, discussion_id, word_id, target, mode } = (await req.json()) as Payload;
    const m: Mode = mode === "planner" || mode === "explain" ? mode : "plain";

    if (word_id) {
      const definition = await defineWord(word_id);
      return json({ ok: true, definition });
    }
    if (share_id) {
      const summary = await summarizeShare(share_id, m);
      return json({ ok: true, mode: m, summary });
    }
    if (article_id) {
      const summary = await summarizeArticle(article_id, m);
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
