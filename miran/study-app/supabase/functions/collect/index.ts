// collect — 테크블로그 신규 글 자동 수집.
//   blogs 테이블의 active 블로그를 돌며 수집방식(collect)에 따라 목록·본문·대표이미지를 뽑아
//   articles 에 upsert(url 중복 무시)한다. 주제/태그는 classify 로 자동 분류.
//
// 수집 방식(blogs.collect):
//   · rss_full   : RSS content:encoded 에 본문 O → 페이지 요청 없이 본문 확보(토스·배민·AWS…)
//   · rss_scrape : RSS 는 목록만 → 각 글 페이지에서 본문 추출(컬리·뱅크샐러드·강남언니)
//   · listscrape : RSS 없음 → sitemap 또는 목록 페이지로 링크 수집 후 각 페이지 추출
//                  (오늘의집=sitemap·경로날짜, 카카오=sitemap·lastmod, 카카오페이=목록, 당근=careers목록·JSON-LD날짜)
//   · nuxt       : (미사용, 예약) SPA 상태 파싱 — 현재는 listscrape+extractStateBody 로 통합
// 그리고 PAGINATED_FEED(NDS 등)는 since 백필 시 WordPress ?paged= 로 과거 페이지를 순회한다.
//
// 호출:
//   POST {}                     → 전체 active 블로그 수집(블로그별 최신 limit개)
//   POST { blog:"toss" }        → 특정 블로그만(테스트/재시도용)
//   POST { limit:5 }            → 블로그별 신규 최대 처리 수(기본 8, 최대 20)
//   POST { since:"2025-06-01" } → 백필: 각 피드/사이트맵에서 그 날짜 이후 글 전부(블로그별 최대 60)
//                                 ※ 피드가 얕은 활성 블로그(AWS·카카오 등)는 피드에 담긴 만큼만 도달
//
// 배포: supabase functions deploy collect
// 스케줄(A5): pg_cron 으로 주기 호출(예: 매시 정각).
import { corsHeaders, json } from "../_shared/cors.ts";
import { serviceClient } from "../_shared/supabase.ts";
import {
  BROWSER_UA,
  CRAWLER_UA,
  extractArticle,
  fetchHtml,
  htmlToText,
  firstBodyImage,
  isSaneImageUrl,
  metaContent,
  stripFooter,
} from "../_shared/extract.ts";
import { extractStateBody, parseFeed, type FeedItem } from "../_shared/feed.ts";
import { classify } from "../_shared/classify.ts";

const PER_BLOG_LIMIT = 8; // 실행당 블로그별 신규 최대 처리 수(엣지 함수 시간 예산 보호)
const SINCE_CAP = 60;     // since 백필 시 블로그별 1회 최대 처리 수(초과분은 재실행으로 이어서)

interface Blog {
  id: string;
  key: string;
  name: string;
  homepage: string | null;
  rss_url: string | null;
  collect: "rss_full" | "rss_scrape" | "nuxt" | "listscrape";
}

// listscrape 전용 설정(RSS 없는 곳). 두 방식 중 하나:
//   · sitemap : sitemap.xml 의 <url> 중 locRe 매칭 글 URL. 날짜는 경로의 yyyy-mm-dd(오늘의집)
//               또는 <lastmod>(카카오) 로 잡아 최신순 정렬 + since 필터 → 과거까지 도달.
//   · list    : 목록 페이지 HTML 을 linkRe 로 스크랩 — 카카오페이(최신만).
// ⚠️ 사이트 개편에 취약 → 배포 후 실측으로 조정 필요.
type ListCfg =
  | { sitemap: string; locRe: RegExp } // locRe: <loc> URL 이 글 상세인지 테스트(전역 플래그 X)
  | { listUrl: string; linkRe: RegExp; base: string };

const LISTSCRAPE: Record<string, ListCfg> = {
  bucketplace: {
    sitemap: "https://www.bucketplace.com/sitemap-0.xml",
    locRe: /^https:\/\/www\.bucketplace\.com\/post\//, // /ko/ /en/ 제외 정본만
  },
  kakao: {
    sitemap: "https://tech.kakao.com/sitemap.xml", // 495개 글(2014~), <lastmod> 보유
    locRe: /^https:\/\/tech\.kakao\.com\/posts\/\d+/,
  },
  // 카카오페이: sitemap 에 글 160개(날짜 없음 → 페이지 "2026. 6. 12" 로 발행일). 순서 무관 —
  //   dedup 으로 신규만 수집되고, 전체 백필은 ?since=2000-01-01 로 여러 번 실행.
  kakaopay: {
    sitemap: "https://tech.kakaopay.com/sitemap-0.xml",
    locRe: /^https:\/\/tech\.kakaopay\.com\/post\//,
  },
  // 당근: careers 목록의 내부글(/blog/post/, JSON-LD 날짜)만 여기서. Medium·seed 는 아래 listItems.
  daangn: {
    listUrl: "https://careers.daangn.com/blog/",
    linkRe: /href=["'](\/blog\/post\/[^"'?#]+)["']/gi,
    base: "https://careers.daangn.com",
  },
};

// 당근 보조 소스: Medium 글은 RSS(글 페이지는 403), seed-design 글은 /updates 목록(당근이 링크하는 디자인 글).
const DAANGN_MEDIUM_FEED = "https://medium.com/feed/daangn";
const SEED_UPDATES_URL = "https://seed-design.io/updates";

// WordPress 계열 피드 백필: since 설정 시 ?paged=2,3… 로 과거 페이지를 순회한다.
const PAGINATED_FEED = new Set<string>(["nds", "bcut"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = serviceClient();
    // 파라미터는 JSON 본문 또는 URL 쿼리(?blog=&limit=&since=) 둘 다 허용
    // (윈도우 curl 에서 JSON 이스케이프가 번거로워 쿼리 방식을 함께 지원).
    const payload = await req.json().catch(() => ({}));
    const qp = new URL(req.url).searchParams;
    const onlyKey: string | undefined = payload?.blog ?? qp.get("blog") ?? undefined;
    const limit = Math.min(Math.max(Number(payload?.limit ?? qp.get("limit")) || PER_BLOG_LIMIT, 1), 20);
    // since: 백필 기준일. 유효한 날짜면 이후 글만, 블로그별 최대 SINCE_CAP 개.
    // refresh: 이미 저장된 글도 **다시 수집해 덮어쓴다**(?refresh=1).
    //   추출기를 고친 뒤 기존 데이터를 되살릴 때 쓴다. 기본값(꺼짐)에서는 신규만 넣는다.
    //   ⚠️ 덮어쓸 때도 값이 비면 기존 값을 지우지 않는다(아래 collectBlog 참고).
    const refresh =
      payload?.refresh === true || payload?.refresh === 1 || qp.get("refresh") === "1";
    // offset: 목록의 앞에서 몇 개를 건너뛸지. refresh 백필에서 **다음 묶음으로 넘어가는** 수단.
    //   refresh 는 이미 저장된 글을 걸러내지 않으므로 offset 없이는 매번 같은 앞부분만 반복된다.
    const offset = Math.max(Number(payload?.offset ?? qp.get("offset")) || 0, 0);
    const sinceRaw = payload?.since ?? qp.get("since");
    const since: string | null =
      typeof sinceRaw === "string" && !isNaN(Date.parse(sinceRaw))
        ? new Date(sinceRaw).toISOString()
        : null;

    // refetch: 목록을 거치지 않고 **DB 의 기존 글을 URL 로 다시 긁는다**(과거 글 백필용).
    const refetch = payload?.refetch === true || qp.get("refetch") === "1";
    if (refetch) {
      const n = Math.min(Math.max(Number(payload?.limit ?? qp.get("limit")) || 20, 1), 60);
      const force = payload?.force === true || qp.get("force") === "1";
      const result = await refetchArticles(supabase, onlyKey, n, offset, force);
      return json({ ok: true, ...result });
    }

    let query = supabase
      .from("blogs")
      .select("id,key,name,homepage,rss_url,collect,kind")
      .eq("active", true);
    if (onlyKey) query = query.eq("key", onlyKey);
    const { data: blogs, error } = await query;
    if (error) return json({ error: error.message }, 500);

    const report: Record<string, unknown>[] = [];
    for (const blog of (blogs ?? []) as Blog[]) {
      try {
        report.push({
          blog: blog.key,
          ...(await collectBlog(supabase, blog, limit, since, refresh, offset)),
        });
      } catch (e) {
        report.push({ blog: blog.key, error: e instanceof Error ? e.message : String(e) });
      }
      await supabase
        .from("blogs")
        .update({ last_collected_at: new Date().toISOString() })
        .eq("id", blog.id);
    }

    const inserted = report.reduce((n, r) => n + (Number(r.inserted) || 0), 0);
    return json({ ok: true, inserted, report });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

/**
 * 이미 저장된 글을 **URL 로 다시 긁어** 본문·대표이미지를 갱신한다.
 *
 * 왜 따로 필요한가: 목록 기반 재수집(refresh)은 **피드/사이트맵에 아직 남아 있는 글만** 닿는다.
 * RSS 는 보통 최근 10~20건만 싣기 때문에, 추출기를 고쳐도 과거 글(올리브영 190건 등)은
 * 영원히 손이 닿지 않는다. 이 모드는 목록을 거치지 않고 DB 의 articles 를 직접 훑는다.
 *
 * 안전장치:
 *   · 이미 본문 이미지와 대표 이미지를 갖춘 글은 건드리지 않는다(skipped).
 *   · 다시 긁은 결과가 비거나 더 짧으면 기존 값을 유지한다(덮어써서 손해 보지 않게).
 */
// deno-lint-ignore no-explicit-any
async function refetchArticles(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  blogKey: string | undefined,
  limit: number,
  offset: number,
  force = false,
): Promise<Record<string, unknown>> {
  let sel = supabase
    .from("articles")
    .select("id,url,body,og_image,blog:blogs!inner(key)")
    .order("published_at", { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1);
  if (blogKey) sel = sel.eq("blogs.key", blogKey);

  const { data, error } = await sel;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as {
    id: string;
    url: string;
    body: string | null;
    og_image: string | null;
  }[];
  if (rows.length === 0) return { mode: "refetch", offset, picked: 0, note: "대상 없음" };

  let fixed = 0;
  let skipped = 0;
  let failed = 0;

  for (const a of rows) {
    const hasMarker = (a.body ?? "").includes("[[img:");
    // force: 추출기를 고친 뒤 **전부 다시** 긁을 때 쓴다(코드 블록 마커 도입 등).
    //   평소엔 멀쩡한 글을 건너뛰어 시간을 아끼지만, 규칙이 바뀌면 그 판단이 낡는다.
    if (!force && hasMarker && a.og_image) {
      skipped++;
      continue; // 이미 멀쩡한 글은 건드리지 않는다
    }

    let page = await fetchExtract(a.url, BROWSER_UA);
    if ((page?.body.length ?? 0) < 200) {
      const alt = await fetchExtract(a.url, CRAWLER_UA);
      if ((alt?.body.length ?? 0) > (page?.body.length ?? 0)) page = alt;
    }
    if (!page) {
      failed++;
      continue;
    }

    const patch: Record<string, unknown> = {};

    // 본문: 이미지 마커가 새로 생겼거나 더 길어졌을 때만 교체.
    const newHasMarker = page.body.includes("[[img:");
    const better = newHasMarker !== hasMarker ? newHasMarker : page.body.length > (a.body?.length ?? 0);
    if (page.body.length >= 200 && (force || better)) {
      patch.body = page.body;
    }

    // 대표 이미지: 없거나 **깨진 값**일 때 채운다.
    //   실측: `https://d2.naver.comd2/...` 처럼 호스트가 붙어버린 값이 저장돼 있었는데,
    //   "있으면 건드리지 않는다" 규칙 때문에 재수집으로도 영영 안 고쳐졌다.
    if (!a.og_image || !isSaneImageUrl(a.og_image)) {
      const img = page.image ?? firstBodyImage((patch.body as string) ?? page.body);
      if (img) patch.og_image = img;
    }

    if (Object.keys(patch).length === 0) {
      skipped++;
      continue;
    }
    const { error: upErr } = await supabase.from("articles").update(patch).eq("id", a.id);
    if (upErr) failed++;
    else fixed++;
  }

  return { mode: "refetch", blog: blogKey ?? "(전체)", offset, picked: rows.length, fixed, skipped, failed };
}

async function collectBlog(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  blog: Blog,
  limit: number,
  since: string | null,
  refresh = false,
  offset = 0,
): Promise<Record<string, unknown>> {
  const items = await listItems(blog, limit, since);
  if (items.length === 0) return { found: 0, inserted: 0, note: "목록 없음" };

  // 이미 저장된 url 조회 — **100개씩 나눠서** 묻는다.
   //   URL 을 수백 개 한 번에 넘기면 쿼리스트링이 너무 길어 통째로 실패하고,
   //   그러면 have 가 비어서 "전부 신규"로 잘못 집계된다(실측: 카카오 498건).
  const urls = items.map((i) => i.url);
  const have = new Set<string>();
  for (let k = 0; k < urls.length; k += 100) {
    const { data } = await supabase
      .from("articles")
      .select("url")
      .in("url", urls.slice(k, k + 100));
    for (const e of (data ?? []) as { url: string }[]) have.add(e.url);
  }

  // refresh 면 이미 저장된 글도 대상에 넣는다(추출기 개선분을 기존 글에 반영하는 용도).
  //   대신 offset 으로 묶음을 옮겨가며 돌려야 전체를 훑을 수 있다.
  const cap = since ? SINCE_CAP : limit;
  const pool = refresh ? items : items.filter((i) => !have.has(i.url));
  const fresh = pool.slice(offset, offset + cap);
  if (fresh.length === 0) {
    return { found: items.length, pool: pool.length, offset, inserted: 0, note: "대상 없음" };
  }

  const rows: Record<string, unknown>[] = [];
  const skipped: string[] = [];
  for (const it of fresh) {
    const built = await buildArticle(blog, it, since);
    if (!built) {
      skipped.push(it.url);
      continue;
    }
    // 덮어쓸 때 값이 빈 칸이면 컬럼을 아예 빼서 **기존 값을 지우지 않는다**.
    //   (재수집에서 og:image 를 못 얻었다고 이미 있던 썸네일을 날리면 손해다.)
    const row: Record<string, unknown> = { blog_id: blog.id };
    for (const [k, v] of Object.entries(built)) {
      if (v === null || v === undefined || v === "") continue;
      row[k] = v;
    }
    rows.push(row);
  }
  if (rows.length === 0) return { found: items.length, inserted: 0, skipped: skipped.length };

  // refresh 면 기존 행을 실제로 갱신해야 하므로 ignoreDuplicates 를 끈다.
  //   upsert 는 rows 에 담긴 컬럼만 덮어쓰므로 조회수·좋아요·인사이트 수와
  //   enrich 로 채운 level/decision/question/terms 는 그대로 보존된다.
  const { error } = await supabase
    .from("articles")
    .upsert(rows, { onConflict: "url", ignoreDuplicates: !refresh });
  if (error) throw new Error(error.message);

  const updated = refresh ? rows.filter((r) => have.has(r.url as string)).length : 0;
  return {
    found: items.length,
    pool: pool.length,
    offset,
    inserted: rows.length - updated,
    updated,
    skipped: skipped.length,
    done: offset + cap >= pool.length, // true 면 이 블로그는 더 돌릴 필요 없음
  };
}

// 블로그 → 후보 아이템 목록(본문은 아직 없음, url/title/메타만 채워질 수 있음).
async function listItems(blog: Blog, limit: number, since: string | null): Promise<FeedItem[]> {
  // 당근: careers 내부글 + Medium RSS(본문 포함) + seed-design.io/updates 글 3원 병합.
  //   Medium·seed 를 앞에 둔다 — collectBlog 가 fresh.slice(0,cap) 로 자르므로 뒤에 두면 잘려나감.
  if (blog.key === "daangn") {
    const listed = await listScrape(blog, limit, since);
    const feed = parseFeed(await fetchHtml(DAANGN_MEDIUM_FEED, BROWSER_UA));
    const medium = since
      ? feed.filter((i) => i.published && i.published >= since)
      : feed.slice(0, Math.max(limit, 12));
    const seed = await seedItems();
    return [...medium, ...seed, ...listed];
  }
  if (blog.collect === "listscrape") return listScrape(blog, limit, since);
  if (!blog.rss_url) return [];
  // WordPress 백필: ?paged=2,3… 로 기준일까지 과거 페이지 순회(NDS 등).
  if (since && PAGINATED_FEED.has(blog.key)) return paginatedFeed(blog.rss_url, since);
  // 피드는 브라우저 UA 우선(D2 는 크롤러 UA 에 SPA 셸만 준다). 0건이면 크롤러 UA 로 재시도.
  let items = parseFeed(await fetchHtml(blog.rss_url, BROWSER_UA));
  if (items.length === 0) items = parseFeed(await fetchHtml(blog.rss_url));
  // 최신순 정렬 — 강남언니처럼 피드가 오래된 글 먼저 주는 경우 대비(그래야 {}/cron 이 최신을 집는다).
  items.sort((a, b) => (b.published ?? "").localeCompare(a.published ?? ""));
  // since 백필: 그 날짜 이후 글 전부(날짜 없는 항목은 제외). 아니면 최신 일부.
  if (since) return items.filter((i) => i.published && i.published >= since);
  return items.slice(0, Math.max(limit, 12));
}

// WordPress 피드 ?paged=N 순회: 기준일(since)보다 오래된 페이지가 나오면 멈춘다(최대 8페이지).
async function paginatedFeed(rssUrl: string, since: string): Promise<FeedItem[]> {
  const sep = rssUrl.includes("?") ? "&" : "?";
  const seen = new Set<string>();
  const acc: FeedItem[] = [];
  for (let p = 1; p <= 8; p++) {
    const items = parseFeed(await fetchHtml(`${rssUrl}${sep}paged=${p}`, BROWSER_UA));
    if (items.length === 0) break;
    for (const it of items) if (!seen.has(it.url)) { seen.add(it.url); acc.push(it); }
    const oldest = items.map((i) => i.published).filter(Boolean).sort()[0];
    if (oldest && oldest < since) break; // 이 페이지가 이미 기준일 이전 → 종료
  }
  return acc.filter((i) => i.published && i.published >= since);
}

// 당근 디자인 글(seed-design.io/updates 목록의 글 링크). 본문·날짜는 buildArticle 이 페이지에서.
async function seedItems(): Promise<FeedItem[]> {
  try {
    const html = await fetchHtml(SEED_UPDATES_URL, BROWSER_UA);
    const seen = new Set<string>();
    const items: FeedItem[] = [];
    for (const m of html.matchAll(/href=["'](\/updates\/[^"'?#]+)["']/gi)) {
      const url = "https://seed-design.io" + m[1];
      if (seen.has(url)) continue;
      seen.add(url);
      items.push({ url, title: "", author: null, published: null, summary: null, contentHtml: null, image: null });
    }
    return items;
  } catch {
    return [];
  }
}

// RSS 없는 사이트: 목록/사이트맵에서 글 링크만 모은다(제목/본문은 buildArticle 이 페이지에서 보강).
async function listScrape(blog: Blog, limit: number, since: string | null): Promise<FeedItem[]> {
  const cfg = LISTSCRAPE[blog.key];
  if (!cfg) return [];
  const cap = since ? SINCE_CAP : Math.max(limit, 12);
  // {url, published(ISO|null)} — sitemap 은 경로 날짜를 발행일로 보존.
  let picked: { url: string; published: string | null }[] = [];

  if ("sitemap" in cfg) {
    // sitemap.xml 의 <url> 블록 파싱 → locRe 로 글 URL 선별 → 날짜는 경로(오늘의집) 또는
    // <lastmod>(카카오) 로 잡아 최신순 정렬. 사이트맵은 순서 무보장이라 직접 정렬한다.
    const xml = await fetchHtml(cfg.sitemap, BROWSER_UA);
    const seen = new Set<string>();
    const dated: { u: string; d: string }[] = [];
    for (const blk of xml.match(/<url\b[\s\S]*?<\/url>/gi) ?? []) {
      const loc = (blk.match(/<loc>([^<]+)<\/loc>/i) ?? [])[1]?.trim();
      if (!loc || seen.has(loc) || !cfg.locRe.test(loc)) continue;
      seen.add(loc);
      const pathDate = (decodeURIComponent(loc).match(/\/(\d{4}-\d{2}-\d{2})/) ?? [])[1];
      const lastmod = (blk.match(/<lastmod>([^<]+)<\/lastmod>/i) ?? [])[1]?.trim().slice(0, 10);
      dated.push({ u: loc, d: pathDate ?? lastmod ?? "" });
    }
    dated.sort((a, b) => b.d.localeCompare(a.d));
    // since 백필: 날짜가 기준일 이후인 것 전부. 날짜 없는 항목(카카오페이 sitemap)은 포함해
    //   페이지에서 발행일 확인 후 buildArticle 이 최종 판단. 평소(since 없음)엔 최신 cap 개.
    const sel = since
      ? dated.filter((x) => !x.d || x.d >= since.slice(0, 10))
      : dated.slice(0, cap);
    picked = sel.map((x) => ({
      url: x.u,
      published: x.d ? new Date(x.d).toISOString() : null,
    }));
  } else {
    // 목록 페이지 스크랩(크롤러 UA 우선, 0건이면 브라우저 UA 재시도). 날짜는 페이지에서 못 얻음.
    let links = scrapeLinks(await fetchHtml(cfg.listUrl), cfg);
    if (links.length === 0) links = scrapeLinks(await fetchHtml(cfg.listUrl, BROWSER_UA), cfg);
    // since 백필: 전부 반환(collectBlog 가 dedup 후 회당 cap 처리 → 여러 번 실행하면 다 채워짐).
    picked = (since ? links : links.slice(0, cap)).map((u) => ({ url: u, published: null }));
  }

  return picked.map((p) => ({
    url: p.url,
    title: "",
    author: null,
    published: p.published,
    summary: null,
    contentHtml: null,
    image: null,
  }));
}

function scrapeLinks(html: string, cfg: { linkRe: RegExp; base: string }): string[] {
  const re = new RegExp(cfg.linkRe.source, "gi");
  const seen = new Set<string>();
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    let href = m[1];
    if (href.startsWith("/")) href = cfg.base + href;
    if (!seen.has(href)) {
      seen.add(href);
      out.push(href);
    }
  }
  return out;
}

// og:image 가 진짜 이미지 URL 인지(SPA 셸의 "<%= image %>" 같은 플레이스홀더 배제).
function validImg(src: string | null): string | null {
  return src && /^https?:\/\//i.test(src) && !src.includes("<%") ? src : null;
}

interface PageData {
  body: string;
  image: string | null;
  excerpt: string | null;
  title: string;
  published: string | null; // 페이지에서 뽑은 발행일(당근 등 목록에 날짜 없는 곳 보강)
}

// 페이지 HTML 에서 발행일 추출: article:published_time 메타 → JSON-LD datePublished
// → 한국어 표시 날짜 "2026. 6. 12"(카카오페이 등, 메타·JSON-LD 가 없는 SPA).
function pageDate(html: string): string | null {
  const meta =
    metaContent(html, "article:published_time") ?? metaContent(html, "article:modified_time");
  let raw = meta ?? (html.match(/"datePublished"\s*:\s*"([^"]+)"/i) ?? [])[1] ?? null;
  if (!raw) {
    const k = html.replace(/<[^>]+>/g, " ").match(/(20\d\d)\s*\.\s*(\d{1,2})\s*\.\s*(\d{1,2})/);
    if (k) raw = `${k[1]}-${k[2].padStart(2, "0")}-${k[3].padStart(2, "0")}`;
  }
  if (!raw) return null;
  const d = new Date(raw.trim());
  return isNaN(d.getTime()) ? null : d.toISOString();
}

// 페이지 1회 fetch → 본문/이미지/발췌/제목/발행일. SPA(Nuxt3/Next/Nuxt2)면 상태 JSON 본문으로 보강.
async function fetchExtract(url: string, ua: string): Promise<PageData | null> {
  try {
    const html = await fetchHtml(url, ua);
    const ex = extractArticle(html, url); // url = 상대경로 이미지 해석 기준
    let body = ex.text ?? "";
    if (body.length < 400) {
      const state = extractStateBody(html, url);
      if (state && state.length > body.length) body = state;
    }
    return {
      body,
      image: ex.image,
      excerpt: ex.excerpt,
      title: (metaContent(html, "og:title") ?? "").trim(),
      published: pageDate(html),
    };
  } catch {
    return null;
  }
}

// 아이템 → articles 행(본문 없으면 null 로 건너뜀). 방식별로 본문·이미지·제목을 확보.
async function buildArticle(
  blog: Blog,
  it: FeedItem,
  since: string | null,
): Promise<Record<string, unknown> | null> {
  // since 백필 방어: 발행일이 있는데 기준일보다 과거면 제외(목록 필터를 통과했더라도).
  if (since && it.published && it.published < since) return null;

  let title = it.title;
  let body = "";
  let image = validImg(it.image);
  let excerpt = it.summary;
  let published = it.published;

  // 피드 본문(content:encoded)이 있으면 방식 무관하게 사용(rss_full, 당근 Medium RSS 등).
  if (it.contentHtml) {
    // 피드 본문 안의 상대경로 이미지(<img src="/content/images/...">)를 글 URL 기준으로 절대화.
    body = stripFooter(htmlToText(it.contentHtml, it.url));
  }

  // 본문 부족(≥400자 미달) · 제목 없음 · 이미지 없음 · 발행일 없음 중 하나라도면 페이지에서 보강.
  if (body.length < 400 || !title || !image || !published) {
    // 1차 UA: scrape/nuxt 는 크롤러(Cloudflare 우회), 그 외는 브라우저.
    const primaryUA = blog.collect === "rss_scrape" || blog.collect === "nuxt" ? CRAWLER_UA : BROWSER_UA;
    let page = await fetchExtract(it.url, primaryUA);
    // 본문 확보 실패 시 반대 UA 로 1회 재시도(사이트별 UA 편차: 오늘의집=브라우저, 카카오=크롤러).
    if ((page?.body.length ?? 0) < 200) {
      const alt = await fetchExtract(it.url, primaryUA === CRAWLER_UA ? BROWSER_UA : CRAWLER_UA);
      if ((alt?.body.length ?? 0) > (page?.body.length ?? 0)) page = alt;
    }
    if (page) {
      if (page.body.length > body.length) body = page.body;
      if (!image) image = validImg(page.image);
      if (!excerpt) excerpt = page.excerpt;
      if (!title) title = page.title;
      if (!published) published = page.published;
    }
  }

  // 대표 이미지 폴백 — og:image 를 끝내 못 얻었으면 본문 첫 이미지를 쓴다.
  //   빈 썸네일 카드보다 본문 이미지가 낫고, 실측상 이 폴백 하나로 올리브영 190건이 살아난다.
  if (!image) image = firstBodyImage(body);

  // 페이지에서 발행일을 얻은 뒤 다시 since 검사(목록에 날짜 없던 당근 등 대응).
  if (since && published && published < since) return null;
  if (!title || body.length < 200) return null; // 제목·최소 본문 없으면 저장 안 함.

  const { topic, tags } = classify(title, body);
  return {
    url: it.url,
    title,
    author: it.author,
    published_at: published,
    summary: excerpt,
    body,
    og_image: image,
    topic,
    tags,
  };
}
