// 로컬 재수집기 — 집 IP에서 본문을 이미지까지 살려 articles 를 갱신한다.
//   목적: (1) 본문 이미지 표시  (2) 배달의민족(Cloudflare 가 서버 IP 차단 → 로컬에서만 수집 가능)
//   방식(blogs.collect 별):
//     · rss_full          → RSS content:encoded(이미지 포함 HTML)에서 본문 추출 (신규+갱신)
//     · rss_scrape/listscrape → 이미 저장된 글 URL을 다시 열어 Readability(페이지 파싱)로 본문·이미지 갱신
//                              (카카오·오늘의집·당근·컬리 등 페이지형 — 신규 발견은 서버 collect가 담당)
//   <img> 는 버리지 않고 [[img:URL]] 마커로 보존해 저장 → 앱이 이미지로 렌더.
//
// 준비: miran/study-app/.env 에 아래 한 줄 추가(이미 있는 EXPO_PUBLIC_* 아래).
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← Supabase 대시보드 Settings > API > service_role(secret) 키
// 실행: (study-app 폴더에서)  npm run recollect
//   특정 블로그만:              npm run recollect -- woowahan
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---- .env 로드(외부 의존성 없이 직접 파싱) ----
function loadEnv() {
  const out = {};
  try {
    const txt = readFileSync(join(__dirname, "..", ".env"), "utf8");
    for (const line of txt.split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* .env 없으면 process.env 만 사용 */
  }
  return { ...out, ...process.env };
}

const env = loadEnv();
const SUPABASE_URL = env.SUPABASE_URL || env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "\n❌ 설정이 필요해요.\n" +
      "  miran/study-app/.env 에 아래 한 줄을 추가하세요:\n" +
      "    SUPABASE_SERVICE_ROLE_KEY=여기에_service_role_키\n" +
      "  (Supabase 대시보드 > Settings > API > service_role(secret) 키 복사)\n",
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

const CRAWLER_UA =
  "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php); kakaotalk-scrap/1.0";
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// ---- HTML → 본문 텍스트(+이미지 마커). extract.ts 와 동일 규칙 ----
function decodeEntities(s) {
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)));
}

// 콘텐츠 이미지가 아닌 것(이모지·스페이서·트래킹 픽셀·아바타)을 URL 로 걸러낸다. (extract.ts 와 동일 규칙)
const IMG_SKIP_RE =
  /s\.w\.org\/images\/core\/emoji|\/emoji\/|twemoji|wp-smiley|spacer\.gif|1x1\.|\/blank\.|\/pixel\.|gravatar\.com\/avatar|\.svg([?#]|$)/i;

function attrValue(tag, name) {
  const m = tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`, "i"));
  return m ? m[1].trim() : "";
}
function srcsetFirst(tag) {
  const raw = attrValue(tag, "srcset");
  if (!raw) return "";
  return raw.split(",")[0]?.trim().split(/\s+/)[0] ?? "";
}
function imgToMarker(tag) {
  if (/\bclass=["'][^"']*wp-smiley[^"']*["']/i.test(tag)) return " ";
  let url =
    attrValue(tag, "data-src") ||
    attrValue(tag, "data-lazy-src") ||
    attrValue(tag, "data-original") ||
    attrValue(tag, "data-echo") ||
    srcsetFirst(tag) ||
    attrValue(tag, "src");
  if (/^\/\//.test(url)) url = "https:" + url;
  if (!/^https?:\/\//.test(url)) return " ";
  if (IMG_SKIP_RE.test(url)) return " ";
  return `\n[[img:${url}]]\n`;
}

function htmlToText(html) {
  let s = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ");
  s = s
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|section|article|tr|blockquote|figure|figcaption)>/gi, "\n");
  s = s.replace(/<img\b[^>]*>/gi, (tag) => imgToMarker(tag));
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  return s
    .split("\n")
    .map((l) => l.replace(/[ \t ]+/g, " ").trim())
    .filter((l) => l.length > 0)
    .join("\n");
}

const FOOTER_RE =
  /(사업자\s*등록\s*번호|통신판매업|대표\s*이사|고객\s*(센터|문의)|개인정보\s*처리방침|이용약관|청소년보호정책|저작권|무단\s*전재|재배포\s*금지|Copyright|All\s+rights\s+reserved|구독|공유하기|이전\s*글|다음\s*글|연관\s*기사|관련\s*기사|©|ⓒ)/i;

function stripFooter(text) {
  if (!text) return "";
  const lines = text.split("\n");
  let end = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const ln = lines[i].trim();
    if (ln.length > 60 && !FOOTER_RE.test(ln)) {
      end = i + 1;
      break;
    }
  }
  return end < 0 ? text.trim() : lines.slice(0, end).join("\n").trim();
}

function firstImageUrl(bodyText, rawHtml) {
  const m = bodyText.match(/\[\[img:(https?:\/\/[^\]]+)\]\]/);
  if (m) return m[1];
  // og:image → secure_url → twitter:image 순으로 폴백(대표 이미지 누락 최소화).
  const metaRe = (key) =>
    new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]+content=["']([^"']+)["']`, "i");
  for (const key of ["og:image", "og:image:secure_url", "og:image:url", "twitter:image", "twitter:image:src"]) {
    const hit = rawHtml.match(metaRe(key));
    if (hit?.[1]) {
      let u = hit[1];
      if (/^\/\//.test(u)) u = "https:" + u;
      return u;
    }
  }
  return null;
}

// ---- RSS 파싱(정규식 — content:encoded 는 CDATA HTML) ----
function tagText(xml, name) {
  const m = xml.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  if (!m) return "";
  return m[1]
    .replace(/^\s*<!\[CDATA\[/, "")
    .replace(/\]\]>\s*$/, "")
    .trim();
}

function parseRssItems(xml) {
  const items = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  return items.map((it) => {
    const contentHtml = tagText(it, "content:encoded") || tagText(it, "description");
    return {
      title: decodeEntities(tagText(it, "title")),
      url: tagText(it, "link").replace(/[?#].*$/, ""),
      pubDate: tagText(it, "pubDate") || tagText(it, "dc:date") || null,
      contentHtml,
    };
  });
}

async function fetchText(url, ua) {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent": ua,
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.7",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.text();
}

function toIso(pubDate) {
  if (!pubDate) return null;
  const d = new Date(pubDate);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function recollectBlog(blog, since) {
  if (!blog.rss_url) return { updated: 0, skipped: "rss 없음" };
  const rows = [];
  const seen = new Set();
  const maxPages = since ? 20 : 1; // since 백필이면 ?paged=N 으로 과거까지 순회(배민 등)
  let reachedOld = false;

  for (let page = 1; page <= maxPages && !reachedOld; page++) {
    const sep = blog.rss_url.includes("?") ? "&" : "?";
    const url = page === 1 ? blog.rss_url : `${blog.rss_url}${sep}paged=${page}`;
    let xml;
    try {
      // 크롤러 UA 우선(배민 Cloudflare 우회), 실패 시 브라우저 UA.
      xml = await fetchText(url, CRAWLER_UA).catch(() => fetchText(url, BROWSER_UA));
    } catch {
      break;
    }
    const items = parseRssItems(xml).filter((it) => it.url && it.contentHtml);
    let fresh = 0;
    for (const it of items) {
      if (seen.has(it.url)) continue;
      seen.add(it.url);
      fresh++;
      const iso = toIso(it.pubDate);
      if (since && iso && iso < since) {
        reachedOld = true; // since 이전 글에 도달 → 백필 종료
        continue;
      }
      const body = stripFooter(htmlToText(it.contentHtml));
      if (body.length < 100) continue; // 본문 너무 짧으면 스킵
      rows.push({
        blog_id: blog.id,
        url: it.url,
        title: it.title || it.url,
        body,
        og_image: firstImageUrl(body, it.contentHtml),
        published_at: iso,
      });
    }
    if (fresh === 0) break; // 더 이상 새 항목 없음(페이지네이션 미지원 피드)
  }

  if (rows.length === 0) return { updated: 0, skipped: "본문 있는 항목 없음" };

  // url 충돌 시 UPDATE(body·og_image 갱신). topic·tags·ai_summaries 는 건드리지 않음(부분 upsert).
  const { error } = await supabase.from("articles").upsert(rows, { onConflict: "url" });
  if (error) return { updated: 0, skipped: `저장 실패(${error.message})` };
  return { updated: rows.length };
}

// 페이지 HTML → Readability 파싱 → 본문(+이미지 마커).
function extractWithReadability(html, url) {
  try {
    const dom = new JSDOM(html, { url });
    const article = new Readability(dom.window.document).parse();
    dom.window.close();
    if (!article?.content) return null;
    const body = stripFooter(htmlToText(article.content));
    return { body, image: firstImageUrl(body, html) };
  } catch {
    return null;
  }
}

// 페이지형(rss_scrape/listscrape) — 이미 저장된 글 URL을 다시 열어 본문·이미지 갱신.
async function recollectPages(blog) {
  const { data: arts, error } = await supabase
    .from("articles")
    .select("id, url")
    .eq("blog_id", blog.id)
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(60);
  if (error) return { updated: 0, skipped: `조회 실패(${error.message})` };
  if (!arts?.length) return { updated: 0, skipped: "저장된 글 없음" };

  let updated = 0;
  for (const a of arts) {
    let html = "";
    try {
      html = await fetchText(a.url, CRAWLER_UA).catch(() => fetchText(a.url, BROWSER_UA));
    } catch {
      continue;
    }
    const ex = extractWithReadability(html, a.url);
    if (!ex || ex.body.length < 150) continue;
    const patch = { body: ex.body };
    if (ex.image) patch.og_image = ex.image; // 이미지 없으면 기존 값 보존
    const { error: upErr } = await supabase.from("articles").update(patch).eq("id", a.id);
    if (!upErr) updated++;
  }
  return { updated };
}

async function main() {
  const only = process.argv[2]; // 예: npm run recollect -- woowahan 2025-07-01
  const sinceArg = process.argv[3]; // 백필 기준일(YYYY-MM-DD). 있으면 과거 페이지까지 순회.
  const since = sinceArg ? new Date(sinceArg).toISOString() : null;
  let query = supabase.from("blogs").select("id, key, name, rss_url, collect").eq("active", true);
  if (only) query = query.eq("key", only);
  const { data: blogs, error } = await query;
  if (error) {
    console.error("blogs 조회 실패:", error.message);
    process.exit(1);
  }
  if (!blogs?.length) {
    console.error("대상 블로그가 없어요.", only ? `key=${only}` : "");
    process.exit(1);
  }

  console.log(
    `\n🔄 재수집 시작 — 활성 블로그 ${blogs.length}개 (이미지 포함)${since ? ` · ${sinceArg} 이후 백필` : ""}\n`,
  );
  let total = 0;
  for (const blog of blogs) {
    const r = blog.collect === "rss_full" ? await recollectBlog(blog, since) : await recollectPages(blog);
    total += r.updated;
    const via = blog.collect === "rss_full" ? "rss" : "page";
    console.log(
      `  ${r.updated ? "✅" : "⚠️ "} ${blog.name.padEnd(10)} [${via}] ${r.updated}건 ${r.skipped ? `(${r.skipped})` : ""}`,
    );
  }
  console.log(`\n완료 — 총 ${total}건 갱신/추가.\n`);
}

main().catch((e) => {
  console.error("오류:", e);
  process.exit(1);
});
