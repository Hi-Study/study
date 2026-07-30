// service_role 클라이언트 팩토리 — RLS 를 우회해 서버가 og_image/ai_summary/
// notifications 를 채웁니다. SERVICE_ROLE_KEY 는 절대 클라이언트에 노출 금지.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export function serviceClient() {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  return createClient(url, key, { auth: { persistSession: false } });
}
