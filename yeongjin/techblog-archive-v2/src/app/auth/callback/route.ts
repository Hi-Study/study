import { NextResponse, type NextRequest } from "next/server";
import { authClient, loginHref, safeNext } from "@/core/shared/auth";

/** 구글 로그인을 마치고 돌아오는 곳 — 받은 코드를 로그인 쿠키로 바꾸고, 누르려던 글로 보낸다 */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const code = req.nextUrl.searchParams.get("code");
  if (code) {
    const { error } = await (await authClient()).auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, req.url));
    console.error("[auth] 로그인 마무리 실패", error.message);
  }
  return NextResponse.redirect(new URL(`${loginHref(next)}&error=callback`, req.url));
}
