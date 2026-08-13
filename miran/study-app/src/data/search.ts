// distill 검색어 로깅 + 실제 급상승 검색어(최근 7일 빈도). 집계는 trending_searches RPC.
import { useMutation, useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";

export async function logSearch(uid: string, term: string): Promise<void> {
  const t = term.trim();
  if (t.length < 2) return; // 너무 짧은 검색은 로깅 제외
  const { error } = await supabase.from("search_logs").insert({ term: t, user_id: uid });
  if (error) throw error;
}

export async function listTrendingSearches(limit = 10): Promise<string[]> {
  const { data, error } = await supabase.rpc("trending_searches", { lim: limit });
  if (error) throw error;
  return (data ?? []).map((r) => r.term);
}

export function useTrendingSearches(limit = 10) {
  return useQuery({
    queryKey: qk.trendingSearches(),
    queryFn: () => listTrendingSearches(limit),
  });
}

export function useLogSearch() {
  const uid = useUid();
  return useMutation({
    mutationFn: (term: string) => logSearch(uid, term),
  });
}
