import { NextResponse, type NextRequest } from "next/server";
import { NEXT_COOKIE, authClient, loginHref, safeNext } from "@/core/shared/auth";
import { getUserPreferences } from "@/core/shared/db";
import { LOGIN_MARK_COOKIE } from "@/lib/analytics";

/**
 * 구글 로그인을 마치고 돌아오는 곳 — 받은 코드를 로그인 쿠키로 바꾸고, 누르려던 글로 보낸다.
 * 온보딩을 아직 안 겪은 사람(행이 없거나 not_started)은 가려던 곳 대신 /onboarding 으로 먼저 보낸다
 * (completed·skipped 는 다시 보여주지 않는다 — docs 참고: 더-들어가-볼까요-기준 아님, 신규 온보딩 스펙 4절).
 */
export async function GET(req: NextRequest) {
  // ?next= 가 빠져 돌아와도 로그인 시작할 때 적어 둔 쿠키로 가려던 곳을 찾는다
  const next = safeNext(req.nextUrl.searchParams.get("next") ?? req.cookies.get(NEXT_COOKIE)?.value);
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const client = await authClient();
    const { data, error } = await client.auth.exchangeCodeForSession(code);
    if (!error) {
      const prefs = data.user ? await getUserPreferences(data.user.id) : null;
      const needsOnboarding = !prefs || prefs.onboardingStatus === "not_started" || prefs.onboardingStatus === "in_progress";
      const dest = needsOnboarding ? `/onboarding?next=${encodeURIComponent(next)}` : next;
      const res = NextResponse.redirect(new URL(dest, req.url));
      res.cookies.delete(NEXT_COOKIE);
      // GA — 화면(AccountSync)이 이 표시를 보고 login 이벤트를 한 번 보낸 뒤 지운다
      res.cookies.set(LOGIN_MARK_COOKIE, "1", { path: "/", sameSite: "lax", maxAge: 300 });
      return res;
    }
    console.error("[auth] 로그인 마무리 실패", error.message);
  }
  return NextResponse.redirect(new URL(`${loginHref(next)}&error=callback`, req.url));
}
