/**
 * 환경 변수 로더. Expo 는 `EXPO_PUBLIC_` 접두사 변수를 빌드시 인라인합니다.
 * (.env / .env.local 또는 EAS Secrets 로 주입)
 */

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // 개발 초기에 값이 비어 있으면 조용히 실패하지 않고 명확히 알립니다.
  console.warn(
    "[env] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 가 비어 있습니다. " +
      ".env.example 을 .env 로 복사한 뒤 Supabase 값을 채우세요.",
  );
}

export const env = {
  supabaseUrl: supabaseUrl ?? "",
  supabaseAnonKey: supabaseAnonKey ?? "",
  get isConfigured() {
    return Boolean(supabaseUrl && supabaseAnonKey);
  },
};
