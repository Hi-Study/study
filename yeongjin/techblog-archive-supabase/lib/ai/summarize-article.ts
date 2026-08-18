import { getArticleById, updateArticleAiSummary } from "@/lib/db/articles";
import { summarizeWithGemini } from "@/lib/ai/gemini";

async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; TechArchiveBot/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    return text.slice(0, 6000);
  } catch {
    return null;
  }
}

// 글 등록(수동/자동 수집) 직후 및 "다시 요약하기" 요청에서 공통으로 쓰는 요약 파이프라인.
export async function summarizeArticle(
  articleId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const article = await getArticleById(articleId);
  if (!article) return { ok: false, error: "글을 찾을 수 없어요" };
  if (!process.env.GEMINI_API_KEY) {
    return {
      ok: false,
      error: "GEMINI_API_KEY가 설정되지 않았어요. .env.local에 키를 넣고 다시 시도해주세요.",
    };
  }

  const bodyText = await fetchArticleText(article.url);

  try {
    const result = await summarizeWithGemini({ title: article.title, description: bodyText });
    if (!result) throw new Error("empty result");

    await updateArticleAiSummary(articleId, {
      problem: result.problem,
      solution: result.solution,
      takeaway: result.designerPmTakeaway,
      status: "ready",
    });
    return { ok: true };
  } catch (e) {
    await updateArticleAiSummary(articleId, { problem: "", solution: "", takeaway: "", status: "error" });
    return { ok: false, error: e instanceof Error ? e.message : "요약 생성에 실패했어요" };
  }
}
