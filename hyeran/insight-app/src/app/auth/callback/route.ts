import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    // 임시 진단: 교환 실패 사유를 URL로 노출 (원인 확인 후 제거)
    return NextResponse.redirect(`${origin}/?error=auth&reason=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}/?error=auth&reason=no_code`);
}
