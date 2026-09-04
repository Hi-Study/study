// Postgres/PostgREST 에러 판별 헬퍼.
// 앱은 최신 스키마를 가정하지만 Supabase SQL 재실행 전인 DB 도 있어서(§11 like_count,
// §21 view_count/opinion_count 등) "컬럼 없음"만은 화면을 비우지 않고 축소 쿼리로 폴백한다.

/** 정렬/필터에 쓴 컬럼이 DB 에 없을 때(Postgres 42703 undefined_column). */
export function isMissingColumnError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  if (!e) return false;
  return e.code === "42703" || /column .* does not exist/i.test(e.message ?? "");
}

/**
 * "함수가 없다"(PostgREST PGRST202 / Postgres 42883).
 * 스키마 SQL 을 아직 안 올린 환경에서 신규 RPC 를 부를 때 나온다.
 * 이런 건 **화면을 깨뜨리지 말고 조용히 비워야** 한다 — 없는 건 배지 하나뿐이다.
 */
export function isMissingFunctionError(error: unknown): boolean {
  const code = (error as { code?: string } | null)?.code ?? "";
  const msg = (error as { message?: string } | null)?.message ?? "";
  return code === "PGRST202" || code === "42883" || /function .* does not exist/i.test(msg);
}
