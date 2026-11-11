import { NextResponse, type NextRequest } from "next/server";
import { NEXT_COOKIE, authClient, loginHref, safeNext } from "@/core/shared/auth";

/** 구글 로그인을 마치고 돌아오는 곳 — 받은 코드를 로그인 쿠키로 바꾸고, 누르려던 글로 보낸다 */
export async function GET(req: NextRequest) {
  // ?next= 가 빠져 돌아와도 로그인 시작할 때 적어 둔 쿠키로 가려던 곳을 찾는다
  const next = safeNext(req.nextUrl.searchParams.get("next") ?? req.cookies.get(NEXT_COOKIE)?.value);
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await (await authClient()).auth.exchangeCodeForSession(code);
    if (!error) {
      const res = NextResponse.redirect(new URL(next, req.url));
      res.cookies.delete(NEXT_COOKIE);
      return res;
    }
    console.error("[auth] 로그인 마무리 실패", error.message);
  }
  return NextResponse.redirect(new URL(`${loginHref(next)}&error=callback`, req.url));
}
