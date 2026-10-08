import { NextResponse, type NextRequest } from "next/server";

/**
 * 사이트 비밀번호 — 글 상세에 원문 전체가 보이므로 팀 안에서만 보게 막는다(브라우저 기본 로그인 창).
 * SITE_PASSWORD 가 설정된 곳(배포)에서만 동작하고, 로컬 개발은 비워 두면 그대로 열린다.
 * 자동 수집(/api/cron/*)은 자체 비밀값(CRON_SECRET)으로 막으므로 여기서 뺀다.
 */
export function proxy(req: NextRequest) {
  const password = process.env.SITE_PASSWORD;
  if (!password) return NextResponse.next();
  const user = process.env.SITE_USER || "insight";

  const header = req.headers.get("authorization") ?? "";
  if (header.startsWith("Basic ")) {
    const [u, ...rest] = atob(header.slice(6)).split(":");
    if (u === user && rest.join(":") === password) return NextResponse.next();
  }
  return new NextResponse("팀 전용 서비스예요. 공유받은 아이디와 비밀번호를 넣어 주세요.", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="INSIGHT", charset="UTF-8"', "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const config = {
  matcher: ["/((?!api/cron|_next/static|_next/image|favicon.ico).*)"],
};
