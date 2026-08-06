// distill 블로그(수집 소스) 조회 — 홈의 "서비스별 보기" 로고 그리드/캐러셀 헤더용.
import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import type { BlogRow } from "@/types/tables";

/** 활성 블로그 전체(이름순). */
export async function listBlogs(): Promise<BlogRow[]> {
  const { data, error } = await supabase
    .from("blogs")
    .select("*")
    .eq("active", true)
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export function useBlogs() {
  return useQuery({
    queryKey: qk.blogs(),
    queryFn: listBlogs,
    staleTime: 5 * 60_000, // 블로그 목록은 거의 안 바뀜
  });
}
