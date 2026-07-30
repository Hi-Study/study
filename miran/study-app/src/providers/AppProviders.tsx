import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";

import { queryClient } from "@/lib/queryClient";
import { AuthProvider } from "@/auth/AuthProvider";
import { ThemeProvider } from "./ThemeProvider";
import { ConfirmProvider } from "./ConfirmProvider";

/**
 * 앱 전역 Provider 조합. 화면(네비게이션)은 아직 없음 — 여기 트리 아래에
 * NavigationContainer / 라우터를 추후 추가합니다.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider>
          <ConfirmProvider>{children}</ConfirmProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
