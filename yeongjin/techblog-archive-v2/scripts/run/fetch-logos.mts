import "../_env.mts";
import * as cheerio from "cheerio";
import fs from "node:fs";
import path from "node:path";
import { COMPANIES } from "../../src/core/0-collect/companies";

/**
 * 회사 블로그가 지정한 아이콘(apple-touch-icon → 가장 큰 icon → /favicon.ico)을 public/logos 에 받는다.
 * 사용: npm run fetch-logos
 * 결과: public/logos/<회사id>.<확장자> — 로고는 각 회사의 상표라 git 에 올리지 않는다. 화면은 이 폴더를 직접 본다(core/0-collect/logos.ts)
 */
const UA = "Mozilla/5.0 (techblog-perspective local demo)";
const outDir = path.join(process.cwd(), "public", "logos");
fs.mkdirSync(outDir, { recursive: true });

const EXT: Record<string, string> = {
  "image/png": "png",
  "image/x-icon": "ico",
  "image/vnd.microsoft.icon": "ico",
  "image/svg+xml": "svg",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** RSS <channel><image><url> — Medium 처럼 플랫폼에서 운영하는 블로그는 여기에만 회사 로고가 있다 */
async function feedImage(feedUrl: string | null): Promise<string | null> {
  if (!feedUrl) return null;
  try {
    const xml = await (await fetch(feedUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) })).text();
    const $ = cheerio.load(xml, { xml: true });
    return $("channel > image > url").first().text().trim() || $("feed > logo, feed > icon").first().text().trim() || null;
  } catch {
    return null;
  }
}

async function candidates(blogUrl: string, feedUrl: string | null): Promise<string[]> {
  const out: string[] = [];
  const fromFeed = await feedImage(feedUrl);
  if (fromFeed) out.push(fromFeed);
  try {
    const res = await fetch(blogUrl, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
    const $ = cheerio.load(await res.text());
    const icons = $('link[rel~="icon"], link[rel="apple-touch-icon"], link[rel="apple-touch-icon-precomposed"]')
      .map((_, el) => ({
        href: $(el).attr("href") ?? "",
        apple: ($(el).attr("rel") ?? "").includes("apple"),
        size: Number(($(el).attr("sizes") ?? "0").split("x")[0]) || 0,
      }))
      .get()
      .filter((i) => i.href)
      .sort((a, b) => Number(b.apple) - Number(a.apple) || b.size - a.size);
    for (const i of icons) out.push(new URL(i.href, res.url).toString());
  } catch {
    /* 페이지 실패 — favicon 만 시도 */
  }
  out.push(new URL("/apple-touch-icon.png", blogUrl).toString(), new URL("/favicon.ico", blogUrl).toString());
  return [...new Set(out)];
}

const map: Record<string, string> = {};
const bytes = new Map<string, { id: string; buf: Buffer; file: string }>();
for (const f of fs.readdirSync(outDir)) fs.rmSync(path.join(outDir, f));

for (const c of COMPANIES) {
  if (!c.blogUrl) continue;
  const list = c.homeUrl ? await candidates(c.homeUrl, null) : await candidates(c.blogUrl, c.feedUrl);
  for (const url of list) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": UA }, signal: AbortSignal.timeout(15000) });
      const type = (res.headers.get("content-type") ?? "").split(";")[0].trim();
      if (!res.ok || !EXT[type]) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length < 200) continue; // 빈 파일·1px 이미지
      bytes.set(c.id, { id: c.id, buf, file: `${c.id}.${EXT[type]}` });
      break;
    } catch {
      /* 다음 후보 */
    }
  }
}

// 여러 회사가 똑같은 파일을 받았으면 플랫폼 공용 아이콘(Medium 등)이다 — 회사 로고가 아니므로 버린다
const seen = new Map<string, number>();
for (const { buf } of bytes.values()) seen.set(buf.toString("base64"), (seen.get(buf.toString("base64")) ?? 0) + 1);
for (const c of COMPANIES) {
  const b = bytes.get(c.id);
  const shared = b && (seen.get(b.buf.toString("base64")) ?? 0) > 1;
  if (b && !shared) {
    fs.writeFileSync(path.join(outDir, b.file), b.buf);
    map[c.id] = `/logos/${b.file}`;
  }
  console.log(`${map[c.id] ? "✓" : "✗"} ${c.name} ${map[c.id] ?? (shared ? "(공용 아이콘이라 제외)" : "")}`);
}
