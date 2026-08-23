import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { type NextRequest } from "next/server";

// 구글 OAuth 로그인 콜백 — signInWithOAuth()가 여기로 돌아오면 code를 세션으로 교환한다.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      redirect(next);
    }
    redirect(`/auth/error?error=${encodeURIComponent(error.message)}`);
  }

  redirect(`/auth/error?error=${encodeURIComponent("로그인 코드가 없어요")}`);
}
