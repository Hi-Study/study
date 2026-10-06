/** 0단계 — 원문 HTML 정제, 텍스트 추출, 블록 나누기(2단계 칸의 근거 번호가 이 블록 번호다) */
import * as cheerio from "cheerio";
import type { AnyNode, Element } from "domhandler";
import sanitizeHtml from "sanitize-html";

/** 원문 HTML 정제 — 스크립트/스타일 제거, 링크는 새 창 */
export function cleanHtml(html: string, baseUrl?: string): string {
  return sanitizeHtml(html, {
    allowedTags: [
      "p", "br", "hr", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote",
      "pre", "code", "strong", "b", "em", "i", "u", "s", "del", "a", "img", "figure", "figcaption",
      "table", "thead", "tbody", "tr", "th", "td", "span", "div", "sup", "sub", "mark",
    ],
    allowedAttributes: { a: ["href", "target", "rel"], img: ["src", "alt", "loading"], td: ["colspan", "rowspan"], th: ["colspan", "rowspan"] },
    allowedSchemes: ["http", "https", "data"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, href: absolutize(attribs.href, baseUrl), target: "_blank", rel: "noopener noreferrer" },
      }),
      img: (tagName, attribs) => ({
        tagName,
        attribs: { ...attribs, src: absolutize(attribs.src, baseUrl), loading: "lazy" },
      }),
    },
    allowedSchemesAppliedToAttributes: ["href", "src"],
    exclusiveFilter: (frame) => frame.tag === "img" && !frame.attribs.src,
  });
}

function absolutize(url: string | undefined, base?: string): string {
  if (!url) return "";
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

export function htmlToText(html: string): string {
  const $ = cheerio.load(html);
  $("br").replaceWith("\n");
  $("p,li,h1,h2,h3,h4,h5,h6,blockquote,pre,tr,figcaption").append("\n");
  return $.root().text().replace(/[ \t ]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

/** 원문 페이지에서 본문 영역만 추출 (RSS 가 티저만 줄 때) */
export function extractMainHtml(pageHtml: string): string {
  const $ = cheerio.load(pageHtml);
  $("script,style,noscript,nav,header,footer,aside,form,iframe").remove();
  const selectors = [
    "article .post-content", ".post-content", ".entry-content", ".article-content", ".post-body",
    "article", "main", "#content", ".content",
  ];
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length && el.text().trim().length > 500) return el.html() ?? "";
  }
  let best = "";
  let bestLen = 0;
  $("div").each((_, el) => {
    const len = $(el).children("p").text().length;
    if (len > bestLen) {
      bestLen = len;
      best = $(el).html() ?? "";
    }
  });
  return best;
}

export type Block = { n: number; tag: string; html: string; text: string; heading: boolean };

const LEAF = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "figure", "table", "hr", "img"]);
const CONTAINER = new Set(["div", "section", "article", "main", "body", "span"]);

/**
 * 원문을 블록(문단·소제목·목록 항목 …)으로 쪼갠다.
 * 분석 단계와 화면이 반드시 같은 함수를 쓴다 — 근거 블록 번호가 서로 맞아야 한다.
 */
export function splitBlocks(html: string): Block[] {
  const $ = cheerio.load(html);
  const out: Block[] = [];
  let pendingInline = "";

  const push = (tag: string, inner: string) => {
    const text = cheerio.load(inner).root().text().replace(/\s+/g, " ").trim();
    if (!text && !/<img|<hr/.test(inner)) return;
    out.push({ n: out.length + 1, tag, html: inner, text, heading: /^h[1-6]$/.test(tag) });
  };
  const flushInline = () => {
    if (pendingInline.trim()) push("p", `<p>${pendingInline}</p>`);
    pendingInline = "";
  };

  const walk = (nodes: AnyNode[]) => {
    for (const node of nodes) {
      if (node.type === "text") {
        pendingInline += $(node).toString();
        continue;
      }
      if (node.type !== "tag") continue;
      const el = node as Element;
      const tag = el.tagName.toLowerCase();
      if (tag === "ul" || tag === "ol") {
        flushInline();
        let i = 0;
        $(el)
          .children("li")
          .each((_, li) => {
            i += 1;
            const start = tag === "ol" ? ` start="${i}"` : "";
            push("li", `<${tag}${start}>${$.html(li)}</${tag}>`);
          });
      } else if (LEAF.has(tag)) {
        flushInline();
        push(tag, $.html(el));
      } else if (CONTAINER.has(tag) && $(el).find("p,h1,h2,h3,h4,h5,h6,ul,ol,pre,figure,table,blockquote").length) {
        flushInline();
        walk(el.children);
      } else {
        pendingInline += $.html(el);
      }
    }
  };
  walk($("body").length ? $("body")[0].children : $.root()[0].children);
  flushInline();
  return out;
}
