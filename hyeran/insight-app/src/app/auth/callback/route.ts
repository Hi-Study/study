import { createClient } from "@/lib/supabase/server";
import { NextResponse, type NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/home";

  // 임시 진단: 환경변수 값에 비-ASCII(>255) 문자가 섞였는지 검사 (값은 노출 안 함)
  const scan = (name: string, v?: string) => {
    if (!v) return `${name}:MISSING`;
    const i = [...v].findIndex((c) => c.charCodeAt(0) > 255);
    return i >= 0 ? `${name}:BAD@${i}=${v.charCodeAt(i)}(len${v.length})` : `${name}:ok(len${v.length})`;
  };
  const envReport = [
    scan("URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
    scan("ANON", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY),
    scan("SITE", process.env.NEXT_PUBLIC_SITE_URL),
  ].join("|");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(`${origin}/?error=auth&env=${encodeURIComponent(envReport)}&reason=${encodeURIComponent(error.message)}`);
  }

  return NextResponse.redirect(`${origin}/?error=auth&env=${encodeURIComponent(envReport)}&reason=no_code`);
}
