import { createClient } from "@supabase/supabase-js";

// 쿠키 없는 서비스 롤 클라이언트 — 유저 무관 공용 데이터(기업·글 목록) 캐시 조회용.
// unstable_cache 안에서는 쿠키/헤더 접근이 불가하므로 이 클라이언트를 쓴다.
export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}
