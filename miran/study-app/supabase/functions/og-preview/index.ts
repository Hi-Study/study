// og-preview — 링크 원문에서 본문(article_text) + OG 메타(설명/이미지/도메인) 추출 후 shares 갱신.
// 클라는 CORS 로 원문을 못 가져오므로 서버에서 처리 (dev/api.md §3).
//
// 배포: supabase functions deploy og-preview --use-api
// 호출: 링크 글 등록 시 앱이 자동 invoke.
import { corsHeaders, json } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { extractArticle, fetchHtml } from "../_shared/extract.ts";

interface Payload {
  share_id?: string;
  discussion_id?: string;
  url: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { share_id, discussion_id, url } = (await req.json()) as Payload;
    if ((!share_id && !discussion_id) || !url) {
      return json({ error: "share_id 또는 discussion_id, 그리고 url 필수" }, 400);
    }

    let source: string | null = null;
    try {
      source = new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return json({ error: "유효하지 않은 URL" }, 400);
    }

    let article = { title: null, text: null, excerpt: null, image: null } as
      ReturnType<typeof extractArticle>;
    try {
      const html = await fetchHtml(url);
      article = extractArticle(html);
    } catch {
      // 원문 확보 실패(페이월/봇차단 등) → 도메인만 저장
    }

    const supabase = serviceClient();
    const patch = {
      source,
      og_image: article.image,
      og_description: article.excerpt,
      article_text: article.text, // 본문 전문(없으면 null → 앱은 원문 이동 버튼)
    };
    const table = discussion_id ? "discussions" : "shares";
    const id = discussion_id ?? share_id!;
    const { error } = await supabase.from(table).update(patch).eq("id", id);

    if (error) return json({ error: error.message }, 500);
    return json({ ok: true, source, hasArticle: Boolean(article.text) });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
