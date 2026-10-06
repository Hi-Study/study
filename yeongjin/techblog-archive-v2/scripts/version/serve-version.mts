import fs from "node:fs";
import http from "node:http";
import path from "node:path";

/**
 * 저장해 둔 HTML 버전을 띄운다.
 * 사용: npm run version -- v01 [포트]   → http://localhost:4001
 */
const name = process.argv[2] ?? "v01";
const port = Number(process.argv[3] ?? 4000 + Number(name.replace(/\D/g, "") || 1));
const dir = path.join(process.cwd(), "versions", name);
const manifest = JSON.parse(fs.readFileSync(path.join(dir, "manifest.json"), "utf8")) as Record<string, string>;

const TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript",
  ".css": "text/css",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

http
  .createServer((req, res) => {
    const u = new URL(req.url ?? "/", "http://x");
    const send = (file: string) => {
      res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    };
    if (u.pathname.startsWith("/_next/")) {
      const f = path.join(dir, decodeURIComponent(u.pathname));
      return fs.existsSync(f) ? send(f) : res.writeHead(404).end();
    }
    // 화면 이동 시 RSC 요청은 없다고 답해 브라우저가 페이지를 통째로 다시 받게 한다
    if (req.headers["rsc"] || u.searchParams.has("_rsc")) return res.writeHead(404).end();
    u.searchParams.delete("_rsc");
    const page = manifest[u.pathname + u.search] ?? manifest[u.pathname];
    if (!page) return res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("이 버전에 저장되지 않은 화면이에요.");
    send(path.join(dir, "pages", page));
  })
  .listen(port, () => console.log(`${name} → http://localhost:${port}`));
