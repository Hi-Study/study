import { createContext, useContext, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";

import { useSession, type SessionStatus } from "./useSession";

interface AuthContextValue {
  status: SessionStatus;
  session: Session | null;
  uid: string | null;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** 익명 세션을 부트스트랩하고 트리 전체에 uid/세션을 제공. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const { status, session, error } = useSession();
  const value: AuthContextValue = {
    status,
    session,
    uid: session?.user.id ?? null,
    error,
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth 는 AuthProvider 내부에서만 사용하세요.");
  return ctx;
}

/** 인증이 보장된 문맥에서 uid 를 강제로 얻음(없으면 예외). 뮤테이션에서 사용. */
export function useUid(): string {
  const { uid } = useAuth();
  if (!uid) throw new Error("세션이 아직 준비되지 않았습니다.");
  return uid;
}
