import { parseHTML } from "linkedom";
import { Readability } from "@mozilla/readability";
import sanitizeHtml from "sanitize-html";
import crypto from "node:crypto";

const BROWSER_USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

export type ExtractedContent = {
  contentHtml: string;
  contentText: string;
  contentHash: string;
};

function toAbsoluteDom(html: string, url: string) {
  // linkedom은 jsdom과 달리 생성자에 base URL을 받지 않으므로 <base>로 상대 링크를 절대 경로화한다.
  const withBase = html.includes("<head")
    ? html
    : `<html><head><base href="${url}"></head><body>${html}</body></html>`;
  const window = parseHTML(withBase);
  if (!window.document.querySelector("base")) {
    const base = window.document.createElement("base");
    base.setAttribute("href", url);
    window.document.head?.prepend(base);
  }
  return window;
}

// 팀원 전체에게 렌더링되는 본문이므로 저장 시점에 허용목록 기반으로 XSS 방지 새니타이징을 거친다.
// DOM 구현체(window) 없이 문자열/파서 기반으로 동작해 서버리스 번들링 문제에서 자유롭다.
function sanitize(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "b", "i", "em", "strong", "u", "s", "del", "mark", "small", "sub", "sup",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "ul", "ol", "li",
      "blockquote", "pre", "code",
      "a", "img", "figure", "figcaption",
      "table", "thead", "tbody", "tr", "th", "td",
      "div", "span",
    ],
    allowedAttributes: {
      a: ["href", "title", "target", "rel"],
      img: ["src", "alt", "title", "width", "height"],
      "*": ["class"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    transformTags: {
      a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer", target: "_blank" }),
    },
  });
}

// 3.2 원문 보존 정책: 본문 전체를 자체 스토리지에 저장(아카이빙 시점 스냅샷)
export async function extractFullContent(url: string): Promise<ExtractedContent> {
  const res = await fetch(url, {
    headers: { "user-agent": BROWSER_USER_AGENT },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`원문을 가져오지 못했습니다 (HTTP ${res.status})`);
  }

  const html = await res.text();
  const window = toAbsoluteDom(html, url);
  const article = new Readability(window.document as unknown as Document).parse();

  const contentText = article?.textContent?.trim() ?? "";

  if (!contentText) {
    throw new Error("본문을 추출하지 못했습니다. 사이트 구조를 지원하지 않을 수 있습니다.");
  }

  const contentHtml = sanitize(article?.content ?? "");
  const contentHash = crypto.createHash("sha256").update(contentText).digest("hex");

  return { contentHtml, contentText, contentHash };
}

// Medium 등 일부 사이트는 원문 페이지 직접 접근을 차단(403)한다.
// RSS가 이미 <content:encoded>로 본문 전체를 제공하는 경우 이를 그대로 사용하는 폴백.
export function extractFromRssContent(rawHtml: string, url: string): ExtractedContent {
  const window = toAbsoluteDom(`<div id="root">${rawHtml}</div>`, url);
  const root = window.document.getElementById("root");
  const contentText = root?.textContent?.trim() ?? "";

  if (!contentText) {
    throw new Error("RSS 본문에서 텍스트를 추출하지 못했습니다.");
  }

  const contentHtml = sanitize(rawHtml);
  const contentHash = crypto.createHash("sha256").update(contentText).digest("hex");

  return { contentHtml, contentText, contentHash };
}
