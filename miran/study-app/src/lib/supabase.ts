// URL/fetch 폴리필 — supabase-js 가 RN 환경에서 동작하려면 최상단에서 import 필요.
import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { env } from "./env";
import type { Database } from "@/types/database";

/**
 * Supabase 클라이언트 (single instance).
 * - 세션은 AsyncStorage 에 영속화 → 앱 재실행 시 익명 세션 유지.
 * - detectSessionInUrl 은 네이티브에선 불필요(딥링크 OAuth 사용 안 함).
 */
export const supabase = createClient<Database>(
  env.supabaseUrl,
  env.supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      // 구글 OAuth(딥링크 복귀 후 code→session 교환)에 PKCE 사용.
      flowType: "pkce",
    },
  },
);
