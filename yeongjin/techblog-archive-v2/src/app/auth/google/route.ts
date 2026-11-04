import { NextResponse, type NextRequest } from "next/server";
import { authClient, loginHref, safeNext } from "@/core/shared/auth";

/** "Google로 계속하기" — 구글 로그인 화면으로 보낸다. 끝나면 구글 → Supabase → /auth/callback 순으로 돌아온다 */
export async function GET(req: NextRequest) {
  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const { data, error } = await (await authClient()).auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${req.nextUrl.origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) {
    console.error("[auth] 구글 로그인 시작 실패", error?.message);
    return NextResponse.redirect(new URL(`${loginHref(next)}&error=start`, req.url));
  }
  return NextResponse.redirect(data.url);
}
