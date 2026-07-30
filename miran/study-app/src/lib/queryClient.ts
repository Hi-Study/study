import { QueryClient } from "@tanstack/react-query";

/**
 * TanStack Query 클라이언트. 서버 상태 캐싱 + 낙관적 업데이트의 기반.
 * (dev/README §1 상태/데이터 레이어)
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
