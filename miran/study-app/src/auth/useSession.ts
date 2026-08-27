import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { env } from "@/lib/env";

export type SessionStatus = "loading" | "ready" | "error";

interface SessionState {
  status: SessionStatus;
  session: Session | null;
  error: string | null;
}

/**
 * 로그인 세션 부트스트랩 (구글 로그인 기반).
 * - 첫 실행: 저장된 세션이 있으면 복원, 없으면 session=null 로 ready → 로그인 화면 노출.
 * - onAuthStateChange 로 로그인/로그아웃을 단일 소스로 반영.
 * - 'ready' 는 "인증 상태를 파악 완료"를 뜻하며, session 이 null 이면 로그인 필요.
 *
 * ⚠️ Supabase 대시보드 > Authentication > Providers 에서 Google 을 켜고,
 *    URL Configuration > Redirect URLs 에 studyapp://** 를 등록해야 로그인이 동작합니다.
 */
export function useSession(): SessionState {
  const [state, setState] = useState<SessionState>({
    status: "loading",
    session: null,
    error: null,
  });

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (!env.isConfigured) {
        setState({
          status: "error",
          session: null,
          error: "Supabase 환경 변수가 설정되지 않았습니다 (.env 확인).",
        });
        return;
      }
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;
        // 개발 모드(Expo Go 등): 세션이 없으면 구글 로그인 대신 익명 세션으로 둘러보기.
        if (!data.session && __DEV__) {
          await supabase.auth.signInAnonymously();
          return; // onAuthStateChange 가 세션을 반영
        }
        setState({ status: "ready", session: data.session, error: null });
      } catch (err) {
        if (!mounted) return;
        setState({
          status: "error",
          session: null,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // 로그인/로그아웃/토큰 갱신을 모두 수신해 세션을 갱신.
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      setState({ status: "ready", session, error: null });
    });

    bootstrap();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
