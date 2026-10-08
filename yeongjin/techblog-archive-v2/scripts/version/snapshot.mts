import fs from "node:fs";
import path from "node:path";

/**
 * 실행 중인 서비스를 정적 HTML 버전으로 저장한다.
 * 사용: npx tsx scripts/snapshot.mts <baseUrl> <버전이름>
 *   예) npx tsx scripts/snapshot.mts http://localhost:3100 v01
 * 결과: versions/<버전>/ (pages/*.html + _next 정적 파일 + manifest.json)
 * 보기: npm run version -- <버전>
 */
const base = process.argv[2] ?? "http://localhost:3100";
const name = process.argv[3] ?? "v01";
const out = path.join(process.cwd(), "versions", name);
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "pages"), { recursive: true });

const FOLLOW = [
  /^\/$/,
  /^\/feed$/,
  /^\/search$/,
  /^\/my$/,
  /^\/excluded$/,
  /^\/articles\/\d+$/,
  /^\/experiences\/[a-z-]+$/,
  /^\/tech\/[a-z-]+$/,
];
const manifest: Record<string, string> = {};
const seenPages = new Set<string>();
const seenAssets = new Set<string>();
const queue = ["/", "/feed", "/search", "/my", "/excluded"];

const decode = (s: string) => s.replace(/&amp;/g, "&");

function shouldFollow(href: string): boolean {
  const u = new URL(href, base);
  if (!FOLLOW.some((re) => re.test(u.pathname))) return false;
  // 피드 필터 조합이 폭발하지 않도록 파라미터 하나까지만
  return [...u.searchParams.keys()].length <= 1;
}

function collectAssets(text: string) {
  for (const m of text.matchAll(/(?:\/_next\/)?static\/(?:chunks|media|css)\/[A-Za-z0-9_.\-~\/@]+?\.(?:js|css|woff2?|png|svg|jpg|webp)/g)) {
    const p = m[0].startsWith("/_next/") ? m[0] : `/_next/${m[0]}`;
    seenAssets.add(p);
  }
}

let n = 0;
while (queue.length) {
  const key = queue.shift()!;
  if (seenPages.has(key)) continue;
  seenPages.add(key);
  const res = await fetch(base + key);
  if (!res.ok) continue;
  const html = await res.text();
  const file = `p${++n}.html`;
  fs.writeFileSync(path.join(out, "pages", file), html);
  manifest[key] = file;
  collectAssets(html);
  for (const m of html.matchAll(/href="(\/[^"#]*)"/g)) {
    const href = decode(m[1]);
    if (href.startsWith("/_next")) continue;
    const u = new URL(href, base);
    const k = u.pathname + u.search;
    if (!seenPages.has(k) && shouldFollow(href)) queue.push(k);
  }
  if (n % 20 === 0) console.log(`페이지 ${n}개…`);
}

// 정적 파일 — JS/CSS 안에서 참조하는 파일까지 따라간다
const done = new Set<string>();
while ([...seenAssets].some((a) => !done.has(a))) {
  for (const a of [...seenAssets]) {
    if (done.has(a)) continue;
    done.add(a);
    const res = await fetch(base + a);
    if (!res.ok) continue;
    const buf = Buffer.from(await res.arrayBuffer());
    const dest = path.join(out, a);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    if (/\.(js|css)$/.test(a)) collectAssets(buf.toString("utf8"));
  }
}

fs.writeFileSync(path.join(out, "manifest.json"), JSON.stringify(manifest, null, 1));
console.log(`✓ ${name}: 페이지 ${n}개, 정적 파일 ${done.size}개 → versions/${name}`);
