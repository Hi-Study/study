import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import sanitizeHtml from "sanitize-html";

export type ExtractedBody = {
  html: string;
  byline: string | null;
};

// 원문 렌더링(PRD v0.2 확정: FEATURE_ORIGINAL_SNAPSHOT) — 팀 내부에서 원문을 서비스 안에서 바로
// 읽을 수 있도록 본문만 추출해 저장한다. 실패하면 null을 반환하고 호출부는 [원문 바로 읽기] 링크로만 대체한다.
// robots.txt/이용약관 확인은 계속 필요(PRD 6.3) — 현재는 명시적 차단 목록이 없어 항상 시도한다.
export async function extractArticleBody(url: string): Promise<ExtractedBody | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const html = await res.text();

    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    if (!article?.content) return null;

    const cleanHtml = sanitizeHtml(article.content, {
      allowedTags: [
        "p", "br", "h1", "h2", "h3", "h4", "h5", "h6",
        "a", "img", "figure", "figcaption",
        "ul", "ol", "li", "blockquote", "pre", "code",
        "strong", "em", "b", "i", "u", "s",
        "table", "thead", "tbody", "tr", "th", "td",
      ],
      allowedAttributes: {
        a: ["href", "title"],
        img: ["src", "alt"],
      },
      allowedSchemes: ["http", "https", "mailto"],
      transformTags: {
        a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
      },
    });

    return { html: cleanHtml, byline: article.byline ?? null };
  } catch {
    return null;
  }
}
