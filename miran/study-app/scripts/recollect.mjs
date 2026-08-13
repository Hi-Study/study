// 로컬 재수집기 — 집 IP에서 RSS 본문(content:encoded)을 받아 이미지까지 살려 articles 를 갱신한다.
//   목적: (1) 본문 이미지 표시  (2) 배달의민족(Cloudflare 가 서버 IP 차단 → 로컬에서만 수집 가능)
//   대상: blogs.collect = 'rss_full' 인 활성 블로그(토스·배민·AWS·무신사·올리브영·네이버 D2/페이 등)
//   RSS content:encoded 는 이미지가 든 완성 HTML → <img> 를 [[img:URL]] 마커로 보존해 저장한다.
//
// 준비: miran/study-app/.env 에 아래 한 줄 추가(이미 있는 EXPO_PUBLIC_* 아래).
//   SUPABASE_SERVICE_ROLE_KEY=eyJ...   ← Supabase 대시보드 Settings > API > service_role(secret) 키
// 실행: (study-app 폴더에서)  npm run recollect
//   특정 블로그만:              npm run recollect -- woowahan
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

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
  s = s.replace(/<img\b[^>]*>/gi, (tag) => {
    const m = tag.match(/\bdata-src=["']([^"']+)["']/i) ?? tag.match(/\bsrc=["']([^"']+)["']/i);
    const url = m?.[1];
    return url && /^https?:\/\//.test(url) ? `\n[[img:${url}]]\n` : " ";
  });
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
  const og = rawHtml.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i);
  return og?.[1] ?? null;
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

async function recollectBlog(blog) {
  if (!blog.rss_url) return { updated: 0, skipped: "rss 없음" };
  let xml;
  try {
    // RSS 는 크롤러 UA 우선(배민 Cloudflare 우회), 실패 시 브라우저 UA.
    xml = await fetchText(blog.rss_url, CRAWLER_UA).catch(() => fetchText(blog.rss_url, BROWSER_UA));
  } catch (e) {
    return { updated: 0, skipped: `RSS 실패(${e.message})` };
  }

  const items = parseRssItems(xml).filter((it) => it.url && it.contentHtml);
  const rows = [];
  for (const it of items) {
    const body = stripFooter(htmlToText(it.contentHtml));
    if (body.length < 100) continue; // 본문 너무 짧으면 스킵
    rows.push({
      blog_id: blog.id,
      url: it.url,
      title: it.title || it.url,
      body,
      og_image: firstImageUrl(body, it.contentHtml),
      published_at: toIso(it.pubDate),
    });
  }
  if (rows.length === 0) return { updated: 0, skipped: "본문 있는 항목 없음" };

  // url 충돌 시 UPDATE(body·og_image 갱신). topic·tags·ai_summaries 는 건드리지 않음(부분 upsert).
  const { error } = await supabase.from("articles").upsert(rows, { onConflict: "url" });
  if (error) return { updated: 0, skipped: `저장 실패(${error.message})` };
  return { updated: rows.length };
}

async function main() {
  const only = process.argv[2]; // 예: npm run recollect -- woowahan
  let q = supabase.from("blogs").select("id, key, name, rss_url, collect").eq("collect", "rss_full");
  if (only) q = q.eq("key", only);
  const { data: blogs, error } = await q;
  if (error) {
    console.error("blogs 조회 실패:", error.message);
    process.exit(1);
  }
  if (!blogs?.length) {
    console.error("대상 블로그가 없어요(collect=rss_full).", only ? `key=${only}` : "");
    process.exit(1);
  }

  console.log(`\n🔄 재수집 시작 — rss_full 블로그 ${blogs.length}개 (이미지 포함)\n`);
  let total = 0;
  for (const blog of blogs) {
    const r = await recollectBlog(blog);
    total += r.updated;
    console.log(`  ${r.updated ? "✅" : "⚠️ "} ${blog.name.padEnd(10)} ${r.updated}건 ${r.skipped ? `(${r.skipped})` : ""}`);
  }
  console.log(`\n완료 — 총 ${total}건 갱신/추가.\n`);
}

main().catch((e) => {
  console.error("오류:", e);
  process.exit(1);
});
