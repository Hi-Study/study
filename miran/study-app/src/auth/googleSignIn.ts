// 구글 로그인 — Supabase OAuth(웹 브로커) + Expo 딥링크 복귀.
//   흐름: 앱 → supabase authorize URL → 구글 → supabase callback → studyapp:// 딥링크로 복귀
//        → 복귀 URL 의 code 를 PKCE 로 세션 교환.
// ⚠️ 실제 OAuth 왕복은 실기기(빌드된 앱)에서만 동작. Supabase 대시보드에 구글 provider +
//    redirect URL(studyapp://**) 이 설정돼 있어야 한다.
import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { supabase } from "@/lib/supabase";

// 인증 세션 복귀 처리를 마무리(웜스타트 대비).
WebBrowser.maybeCompleteAuthSession();

function extractParam(url: string, key: string): string | null {
  try {
    const u = new URL(url);
    const fromQuery = u.searchParams.get(key);
    if (fromQuery) return fromQuery;
    const hash = url.includes("#") ? url.split("#")[1] : "";
    return new URLSearchParams(hash).get(key);
  } catch {
    return null;
  }
}

/** 구글 로그인 시작 → 성공 시 세션이 설정됨. 사용자가 취소하면 조용히 반환. */
export async function signInWithGoogle(): Promise<void> {
  const redirectTo = Linking.createURL("/");

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data?.url) throw new Error("구글 로그인 주소를 만들지 못했어요.");

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== "success") return; // 사용자가 취소/닫음

  const code = extractParam(result.url, "code");
  if (code) {
    const { error: exErr } = await supabase.auth.exchangeCodeForSession(code);
    if (exErr) throw exErr;
    return;
  }

  // implicit 폴백(해시 토큰) — 혹시 code 가 없을 때.
  const access_token = extractParam(result.url, "access_token");
  const refresh_token = extractParam(result.url, "refresh_token");
  if (access_token && refresh_token) {
    const { error: sErr } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sErr) throw sErr;
    return;
  }

  throw new Error("로그인 정보를 받지 못했어요. 다시 시도해주세요.");
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}
