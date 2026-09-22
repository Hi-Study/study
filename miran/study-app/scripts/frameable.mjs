/**
 * blogs.frameable 채우기 — **이 블로그를 아이프레임 안에 띄울 수 있나.**
 *
 *   node scripts/frameable.mjs          # 아직 확인 안 한 블로그만
 *   node scripts/frameable.mjs --all    # 전부 다시 확인
 *
 * 왜 서버가 미리 확인하나: `X-Frame-Options` 로 막혔다는 걸 **클라이언트는 감지할 수 없다**
 * (크로스오리진이라 iframe 안을 못 보고, onError 도 안 온다). 그래서 예전엔 눌러야
 * 빈 화면을 만났고 안내조차 못 띄웠다. 미리 알아 두면 **누르기 전에** 올바른 문을 보여줄 수 있다.
 *
 * LLM 을 안 쓴다 — 토큰이 들지 않는다. 블로그가 20곳뿐이라 1분이면 끝난다.
 * 블로그를 새로 추가했을 때 한 번 돌리면 된다.
 *
 * ⚠️ 최신 글 URL 로 확인한다. 홈페이지와 글 페이지의 헤더가 다른 사이트가 있어서다.
 *    글이 없으면 홈페이지로 떨어진다.
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const URL_BASE = env.EXPO_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_BASE || !SERVICE) {
  console.error(".env 에 EXPO_PUBLIC_SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 가 있어야 합니다.");
  process.exit(1);
}

const all = process.argv.includes("--all");
const headers = { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" };

/**
 * 프레임 삽입을 막는가 — `X-Frame-Options` 또는 CSP 의 `frame-ancestors`.
 * 둘 중 **하나라도 있으면 막는 것으로 본다.** `frame-ancestors` 가 우리 도메인을 허용하는
 * 경우도 이론상 있지만, 남의 블로그가 우리를 허용해 둘 리 없다.
 */
function blockedBy(res) {
  const xfo = res.headers.get("x-frame-options");
  if (xfo) return `XFO=${xfo}`;
  const csp = res.headers.get("content-security-policy") ?? "";
  const m = csp.match(/frame-ancestors[^;]*/i);
  return m ? m[0].slice(0, 60) : null;
}

const res = await fetch(`${URL_BASE}/rest/v1/blogs?select=id,key,name,homepage&order=name`, { headers });
if (!res.ok) throw new Error(`블로그 조회 실패: ${res.status}`);
const blogs = await res.json();

let ok = 0;
let blocked = 0;
let unknown = 0;

for (const b of blogs) {
  // 그 블로그의 최신 글 하나 — 홈페이지와 글 페이지의 헤더가 다를 수 있다.
  const aRes = await fetch(
    `${URL_BASE}/rest/v1/articles?select=url&blog_id=eq.${b.id}&order=published_at.desc&limit=1`,
    { headers },
  );
  const [article] = await aRes.json();
  const target = article?.url ?? b.homepage;
  if (!target) {
    unknown++;
    console.log(`? 주소없음  ${b.name}`);
    continue;
  }

  let frameable = null;
  let why = "";
  try {
    // HEAD 를 안 쓴다 — HEAD 에 헤더를 안 실어 주는 서버가 있다. GET 으로 받고 본문은 버린다.
    const r = await fetch(target, { redirect: "follow", headers: { "User-Agent": "Mozilla/5.0" } });
    const reason = blockedBy(r);
    frameable = !reason;
    why = reason ?? "";
  } catch (e) {
    why = String(e.message ?? e).slice(0, 40);
  }

  if (frameable === null) {
    unknown++;
    console.log(`? 확인실패  ${b.name.padEnd(12)} ${why}`);
  } else if (frameable) {
    ok++;
    console.log(`○ 앱 안에서 ${b.name.padEnd(12)}`);
  } else {
    blocked++;
    console.log(`✖ 새 탭     ${b.name.padEnd(12)} ${why}`);
  }

  if (frameable !== null || all) {
    await fetch(`${URL_BASE}/rest/v1/blogs?id=eq.${b.id}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ frameable, frameable_checked_at: new Date().toISOString() }),
    });
  }
}

console.log(`\n=== 결과 ===\n  ${ok} 앱 안에서 열림 · ${blocked} 새 탭으로 보냄 · ${unknown} 확인 실패`);
