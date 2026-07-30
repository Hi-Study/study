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
 * 익명 인증 부트스트랩 (dev/api.md §1: 로그인 화면 없음 → Anonymous Auth).
 * - 첫 실행: 세션이 없으면 signInAnonymously() 로 화면 없이 사용자 자동 생성.
 * - auth.users insert 트리거가 users 프로필(name '게스트') 자동 생성.
 * - 이후 실행: AsyncStorage 에 영속된 세션 복원.
 *
 * ⚠️ Supabase 대시보드 > Authentication > Providers 에서 **Anonymous sign-ins**
 *    를 활성화해야 동작합니다.
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
        if (!data.session) {
          const { error } = await supabase.auth.signInAnonymously();
          if (error) throw error;
        }
      } catch (err) {
        if (!mounted) return;
        setState({
          status: "error",
          session: null,
          error: err instanceof Error ? err.message : String(err),
        });
        return;
      }
    }

    // 세션 변화를 단일 소스로 구독 (초기 + 이후 변경 모두 수신).
    // ⚠️ 첫 실행 시 supabase 는 session=null 인 INITIAL_SESSION 이벤트를 먼저 보낸다.
    //    이때 'ready' 로 넘기면 로그인 전에 화면이 떠서 uid 없이 크래시하므로,
    //    **세션이 실제로 존재할 때만** ready 로 전환한다. (익명 로그인은 곧 성공)
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session) {
        setState({ status: "ready", session, error: null });
      }
    });

    bootstrap();

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return state;
}
