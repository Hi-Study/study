import { NextResponse, type NextRequest } from "next/server";
import { NEXT_COOKIE, authClient, loginHref, safeNext } from "@/core/shared/auth";
import { getUserPreferences } from "@/core/shared/db";
import { LOGIN_MARK_COOKIE, ONBOARDING_MARK_COOKIE } from "@/lib/analytics";

/**
 * 구글 로그인을 마치고 돌아오는 곳 — 받은 코드를 로그인 쿠키로 바꾸고, 누르려던 글로 그대로 보낸다.
 * 온보딩을 아직 안 겪은 사람(행이 없거나 not_started)은 별도 페이지로 보내지 않고, 가려던 화면 위에
 * 팝업으로 뜨도록 표시만 남긴다(OnboardingModal 이 읽어서 자동으로 연다). completed·skipped 는 다시 띄우지 않는다.
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
      const res = NextResponse.redirect(new URL(next, req.url));
      res.cookies.delete(NEXT_COOKIE);
      // GA — 화면(AccountSync)이 이 표시를 보고 login 이벤트를 한 번 보낸 뒤 지운다
      res.cookies.set(LOGIN_MARK_COOKIE, "1", { path: "/", sameSite: "lax", maxAge: 300 });
      if (needsOnboarding) res.cookies.set(ONBOARDING_MARK_COOKIE, "1", { path: "/", sameSite: "lax", maxAge: 300 });
      return res;
    }
    console.error("[auth] 로그인 마무리 실패", error.message);
  }
  return NextResponse.redirect(new URL(`${loginHref(next)}&error=callback`, req.url));
}
