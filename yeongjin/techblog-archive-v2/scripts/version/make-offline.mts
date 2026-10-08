import fs from "node:fs";
import path from "node:path";

/**
 * 저장한 버전(versions/<이름>)을 서버 없이 파일로 열 수 있는 HTML 묶음으로 바꾼다.
 * 사용: npx tsx scripts/version/make-offline.mts v02
 * 결과: versions/<이름>-offline/index.html 을 더블클릭하면 서비스처럼 동작한다.
 *
 * 하는 일
 * - 화면마다 파일 하나: "/" → index.html, "/articles/29" → articles/29.html, 쿼리가 붙은 화면은 이름 뒤에 표식
 * - 모든 절대 경로(/_next, /logos, 화면 링크)를 그 파일 위치 기준 상대 경로로
 * - 화면 이동은 Next.js 의 서버 요청 대신 파일 이동으로 (클릭을 먼저 가로챈다)
 * - 저장하지 않은 화면(예: 새 검색어)으로 가면 안내 화면
 */
const name = process.argv[2] ?? "v02";
const ROOT = process.cwd();
const src = path.join(ROOT, "versions", name);
const out = path.join(ROOT, "versions", `${name}-offline`);
const manifest = JSON.parse(fs.readFileSync(path.join(src, "manifest.json"), "utf8")) as Record<string, string>;

fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

/* ── 화면 주소 → 파일 이름 ── */
function slugQuery(q: string): string {
  const s = decodeURIComponent(q.replace(/\+/g, " "))
    .replace(/[\\/:*?"<>|#%&=\s]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s.slice(0, 60) || "q";
}
function fileFor(key: string): string {
  const u = new URL(key, "http://x");
  const base = u.pathname === "/" ? "index" : u.pathname.replace(/^\//, "");
  return u.search ? `${base}__${slugQuery(u.search.slice(1))}.html` : `${base}.html`;
}
const files: Record<string, string> = {};
for (const key of Object.keys(manifest)) files[key] = fileFor(key);

const rel = (fromFile: string, target: string) => {
  let r = path.posix.relative(path.posix.dirname(fromFile), target);
  if (!r.startsWith(".")) r = "./" + r;
  return r;
};

/* ── 클릭을 가로채 파일로 이동 + 오프라인 안내 ──
 * 브라우저가 나중에 새로 그린 링크(탭을 바꾼 뒤의 글 목록 등)는 href 가 "/articles/41" 같은 절대 경로라
 * 화면 목록표(OFFLINE_MAP)로 파일을 찾아 보낸다. Next.js 의 서버 요청·미리 받기는 파일에서 동작하지 않으니 막는다.
 */
const MAP_FILE = "_offline-map.js";
const SHIM = (prefix: string) => `<script>
TURBOPACK_CHUNK_BASE_PATH=${JSON.stringify(prefix + "_next/")};
window.__OFFLINE_ROOT=new URL(${JSON.stringify(prefix)},location.href).href;
(function(){var f=window.fetch;window.fetch=function(u,o){var s=String(u&&u.url||u);if(s.indexOf("_rsc=")>-1)return new Promise(function(){});return f.apply(this,arguments);};})();
window.addEventListener("click",function(e){
  if(e.defaultPrevented||e.button!==0||e.metaKey||e.ctrlKey||e.shiftKey)return;
  var a=e.target.closest&&e.target.closest("a[href]");if(!a||a.target==="_blank")return;
  var h=a.getAttribute("href");if(!h||/^(https?:|mailto:|#)/.test(h))return;
  e.preventDefault();e.stopPropagation();
  if(h.charAt(0)==="/"){var m=window.__OFFLINE_MAP||{},u=new URL(h,"http://x"),t=m[u.pathname+u.search]||m[u.pathname]||"_not-saved.html";location.href=window.__OFFLINE_ROOT+t;return;}
  location.href=a.href;
},true);
window.addEventListener("submit",function(e){
  var i=e.target.querySelector&&e.target.querySelector("input");if(!i)return;
  e.preventDefault();e.stopPropagation();var q=i.value.trim();if(!q)return;
  var m=window.__OFFLINE_MAP||{};location.href=window.__OFFLINE_ROOT+(m["/search?q="+encodeURIComponent(q)]||"_not-saved.html");
},true);
</script><script src="${prefix}${MAP_FILE}"></script>`;

/* ── 화면 저장 ── */
const usedLogos = new Set<string>();
let missingLinks = 0;
for (const [key, pfile] of Object.entries(manifest)) {
  const file = files[key];
  let html = fs.readFileSync(path.join(src, "pages", pfile), "utf8");
  const depth = file.split("/").length - 1;
  const prefix = depth ? "../".repeat(depth) : "./";

  // 화면 링크 href="/…"
  html = html.replace(/href="(\/(?!_next\/|logos\/)[^"#]*)"/g, (m, h: string) => {
    const k = h.replace(/&amp;/g, "&");
    if (k.startsWith("/favicon")) return `href="${prefix}favicon.ico"`;
    const u = new URL(k, "http://x");
    const target = files[u.pathname + u.search] ?? files[u.pathname];
    if (!target) {
      missingLinks++;
      return `href="${rel(file, "_not-saved.html")}"`;
    }
    return `href="${rel(file, target)}"`;
  });
  // 로고·정적 파일
  html = html.replace(/(src|href)="\/(logos\/[^"]+)"/g, (m, attr: string, p: string) => {
    usedLogos.add(p);
    return `${attr}="${prefix}${p}"`;
  });
  html = html.replace(/(["(])\/(favicon\.ico|[a-z]+\.svg)/g, (m, q: string, p: string) => `${q}${prefix}${p}`);
  // 화면 데이터(스크립트 안 문자열)의 로고 경로 — 브라우저가 나중에 새로 그리는 로고 이미지용
  html = html.replace(/(\\?")\/(logos\/[^"\\]+)/g, (m, q: string, p: string) => {
    usedLogos.add(p);
    return `${q}${prefix}${p}`;
  });
  // /_next/ — 속성과 화면 데이터(스크립트 안 문자열) 모두
  html = html.split("/_next/").join(`${prefix}_next/`);
  // 폰트 미리 불러오기 링크 — 파일로 열면 차단되고, 폰트는 CSS 안에 직접 넣었으니 필요 없다
  html = html.replace(/<link[^>]*as="font"[^>]*\/?>/g, "");
  // 화면 데이터 안의 폰트 미리 불러오기 지시 한 줄  :HL["…woff2","font",{…}]\n
  html = html.replace(/:HL\[\\"[^"\\]*\.woff2\\",\\"font\\",\{[^}]*\}\]\\n/g, "");
  // 런타임이 읽기 전에 기준 경로와 클릭 가로채기를 넣는다
  html = html.replace(/<head>/, `<head>${SHIM(prefix)}`);

  const dest = path.join(out, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, html);
}

/* ── 정적 파일: _next 그대로 복사, CSS 안의 절대 경로는 CSS 위치 기준으로 ── */
function copyDir(from: string, to: string) {
  for (const f of fs.readdirSync(from, { withFileTypes: true })) {
    const a = path.join(from, f.name);
    const b = path.join(to, f.name);
    if (f.isDirectory()) {
      fs.mkdirSync(b, { recursive: true });
      copyDir(a, b);
    } else if (f.name.endsWith(".css")) {
      // 파일(file://)로 연 페이지는 폰트 파일을 따로 불러올 수 없다(브라우저 보안) — 폰트는 CSS 안에 직접 넣는다
      const css = fs.readFileSync(a, "utf8").replace(/url\(["']?([^)"']+?\.(woff2?|ttf|otf))["']?\)/g, (m, p: string, ext: string) => {
        const clean = p.split("?")[0];
        const file = clean.startsWith("/") ? path.join(src, clean) : path.resolve(path.dirname(a), clean);
        if (!fs.existsSync(file)) return m;
        const mime = ext === "woff2" ? "font/woff2" : ext === "woff" ? "font/woff" : "font/ttf";
        return `url(data:${mime};base64,${fs.readFileSync(file).toString("base64")})`;
      });
      const relToRoot = path.posix.relative(path.posix.dirname(path.relative(out, b).split(path.sep).join("/")), ".") || ".";
      fs.writeFileSync(b, css.split("url(/_next/").join(`url(${relToRoot}/_next/`));
    } else fs.copyFileSync(a, b);
  }
}
fs.mkdirSync(path.join(out, "_next"), { recursive: true });
copyDir(path.join(src, "_next"), path.join(out, "_next"));

// 화면 목록표 — 클릭 가로채기가 절대 경로 링크를 파일로 바꿀 때 쓴다
fs.writeFileSync(path.join(out, MAP_FILE), `window.__OFFLINE_MAP=${JSON.stringify(files)};\n`);

// 로고·아이콘
for (const p of usedLogos) {
  const from = path.join(ROOT, "public", p);
  if (fs.existsSync(from)) {
    fs.mkdirSync(path.dirname(path.join(out, p)), { recursive: true });
    fs.copyFileSync(from, path.join(out, p));
  }
}
const fav = path.join(ROOT, "src", "app", "favicon.ico");
if (fs.existsSync(fav)) fs.copyFileSync(fav, path.join(out, "favicon.ico"));

// 저장하지 않은 화면 안내
fs.writeFileSync(
  path.join(out, "_not-saved.html"),
  `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>저장되지 않은 화면</title>
<style>body{font-family:Pretendard,system-ui,sans-serif;background:#f6f7f9;color:#191f28;display:grid;place-items:center;min-height:100vh;margin:0}div{background:#fff;border-radius:24px;padding:32px;max-width:420px;text-align:center}a{color:#3b5bfd;font-weight:700}</style></head>
<body><div><h1 style="font-size:20px">이 화면은 저장 버전에 없어요</h1><p style="color:#4e5968;line-height:1.6">오프라인 HTML 버전은 저장 시점의 화면만 담고 있어요. 새 검색어로 검색하는 것처럼 서버가 필요한 화면은 열리지 않아요.</p><p><a href="./index.html">홈으로</a></p></div></body></html>`,
);

// 읽어보기
fs.writeFileSync(
  path.join(out, "README.txt"),
  `관점 아카이브 — ${name} 오프라인 HTML 버전\n\nindex.html 을 더블클릭하면 브라우저에서 열려요. 인터넷 연결 없이도 화면 이동·카드 넘김·탭·바텀시트가 동작해요.\n(글 썸네일 이미지는 원래 블로그에서 불러오므로 인터넷이 필요해요.)\n\n- 화면 ${Object.keys(manifest).length}개 저장\n- 저장 시점: ${new Date().toISOString().slice(0, 16).replace("T", " ")}\n- 새 검색어 검색처럼 서버가 필요한 동작은 안내 화면으로 이동해요.\n- 저장한 글·읽은 글은 이 브라우저에만 남아요.\n- 수집한 원문이 들어 있어요. 팀 내부에서만 공유하고 공개 저장소에는 올리지 마세요.\n`,
);

console.log(`✓ ${name}-offline: 화면 ${Object.keys(manifest).length}개, 저장 안 된 링크 ${missingLinks}곳, 로고 ${usedLogos.size}개 → versions/${name}-offline/index.html`);
