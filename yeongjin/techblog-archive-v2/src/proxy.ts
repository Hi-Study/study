import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig, loginHref, needsLogin } from "@/core/shared/auth";

/**
 * 요청이 화면에 닿기 전 두 겹의 문:
 * 1) 사이트 비밀번호(선택) — SITE_PASSWORD 가 설정된 곳에서만 사이트 전체를 브라우저 기본 로그인 창으로 막는다.
 * 2) 구글 로그인 — 글 상세·마이(auth.ts 의 needsLogin)만. 로그인 안 했으면 /login 으로 보내고, 했으면 만료된 토큰을 갱신한다.
 * 자동 수집(/api/cron/*)은 자체 비밀값(CRON_SECRET)으로 막으므로 여기서 뺀다.
 */
export async function proxy(req: NextRequest) {
  const blocked = sitePassword(req);
  if (blocked) return blocked;
  if (!needsLogin(req.nextUrl.pathname)) return NextResponse.next();
  return loginGate(req);
}

function sitePassword(req: NextRequest): NextResponse | null {
  const password = process.env.SITE_PASSWORD;
  if (!password) return null;
  const user = process.env.SITE_USER || "insight";

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const [u, ...rest] = atob(header.slice(6)).split(":");
    if (u === user && rest.join(":") === password) return null;
  }
  return new NextResponse("팀 전용 서비스예요. 공유받은 아이디와 비밀번호를 넣어 주세요.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="INSIGHT", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function loginGate(req: NextRequest): Promise<NextResponse> {
  const toLogin = () => NextResponse.redirect(new URL(loginHref(req.nextUrl.pathname + req.nextUrl.search), req.url));
  const cfg = authConfig();
  if (!cfg) return toLogin(); // 키가 없으면 로그인 화면이 설정 안내를 보여 준다

  // Supabase 권장 방식 — 갱신된 토큰 쿠키를 요청(이번 화면)과 응답(브라우저) 양쪽에 실어 보낸다
  let res = NextResponse.next({ request: req });
  const sb = createServerClient(cfg.url, cfg.key, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list, headers) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value));
        res = NextResponse.next({ request: req });
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
        Object.entries(headers).forEach(([k, v]) => res.headers.set(k, v));
      },
    },
  });
  const { data } = await sb.auth.getClaims();
  if (data) return res;

  const out = toLogin();
  res.cookies.getAll().forEach((c) => out.cookies.set(c)); // 만료돼 지운 쿠키도 브라우저에 반영
  return out;
}

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
