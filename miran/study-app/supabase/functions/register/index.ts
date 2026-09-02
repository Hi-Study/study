// register — 사용자가 URL 로 직접 등록한 글을 수집기와 동일하게 본문 추출해 articles 에 저장.
//   · { url, user_id } → 중복이면 기존 글 반환, 아니면 fetch+추출 후 삽입(service role)
//   · 블로그는 homepage 도메인 매칭, 없으면 시스템 '직접 등록' 블로그로 귀속
//   · 본문 추출은 수집기의 extractArticle 재사용(크롤러 UA 우선 + 브라우저 UA 재시도)
// 배포: supabase functions deploy register --use-api
import { corsHeaders, json } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import { extractArticle, fetchHtml, metaContent, CRAWLER_UA, BROWSER_UA } from "../_shared/extract.ts";

interface Payload {
  url?: string;
  user_id?: string;
}

function domainOf(u: string): string {
  try {
    return new URL(u).host.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function rootDomain(host: string): string {
  const p = host.split(".");
  return p.length > 2 ? p.slice(-2).join(".") : host;
}

function pageTitle(html: string): string {
  const og = metaContent(html, "og:title");
  if (og) return og.trim();
  const t = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "";
  return t.replace(/\s+/g, " ").trim();
}

// URL 도메인에 맞는 블로그 id 를 찾고, 없으면 시스템 '직접 등록' 블로그로 귀속.
async function resolveBlogId(
  supabase: ReturnType<typeof serviceClient>,
  url: string,
): Promise<string> {
  const host = domainOf(url);
  const root = rootDomain(host);

  const { data: blogs } = await supabase.from("blogs").select("id, homepage");
  for (const b of blogs ?? []) {
    if (!b.homepage) continue;
    const bh = domainOf(b.homepage);
    if (bh && (bh === host || rootDomain(bh) === root)) return b.id;
  }

  const { data: sys } = await supabase.from("blogs").select("id").eq("key", "user").maybeSingle();
  if (sys) return sys.id;

  // 시스템 블로그가 아직 없으면 생성(방어 — 보통은 스키마 시드로 존재).
  const { data: created } = await supabase
    .from("blogs")
    .insert({ key: "user", name: "직접 등록", collect: "listscrape", active: false })
    .select("id")
    .single();
  return created!.id;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url, user_id } = (await req.json()) as Payload;
    const clean = (url ?? "").trim();
    if (!clean || !/^https?:\/\//i.test(clean)) return json({ error: "올바른 URL 을 입력해주세요." }, 400);

    const supabase = serviceClient();

    // 1) 중복 확인 — 이미 있으면 그 글로 안내.
    const { data: existing } = await supabase
      .from("articles")
      .select("id, title")
      .eq("url", clean)
      .maybeSingle();
    if (existing) {
      return json({ ok: true, article_id: existing.id, title: existing.title, existed: true });
    }

    // 2) 본문 확보 — 크롤러 UA 우선, 부족하면 브라우저 UA 로 1회 재시도.
    let html = "";
    try {
      html = await fetchHtml(clean, CRAWLER_UA);
    } catch {
      html = "";
    }
    let ex = html ? extractArticle(html, clean) : null;
    let body = ex?.text ?? "";
    if (body.length < 300) {
      try {
        const html2 = await fetchHtml(clean, BROWSER_UA);
        const ex2 = extractArticle(html2, clean);
        if ((ex2.text?.length ?? 0) > body.length) {
          html = html2;
          ex = ex2;
          body = ex2.text ?? "";
        }
      } catch {
        // 재시도 실패 무시 — 제목만이라도 등록.
      }
    }

    const title = (html ? pageTitle(html) : "") || clean;
    const blog_id = await resolveBlogId(supabase, clean);

    // 3) 삽입(service role → RLS 우회). 발행일은 등록 시각으로.
    const { data: created, error } = await supabase
      .from("articles")
      .insert({
        blog_id,
        url: clean,
        title,
        body: body || null,
        og_image: ex?.image ?? null,
        summary: ex?.excerpt ?? null,
        published_at: new Date().toISOString(),
        submitted_by: user_id ?? null,
      })
      .select("id")
      .single();
    if (error || !created) return json({ error: error?.message ?? "등록에 실패했어요." }, 500);

    return json({ ok: true, article_id: created.id, title, existed: false });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
