-- AI 요약 저장 컬럼 (Supabase 복구 후 적용)
alter table public.articles
  add column if not exists ai_summary text,
  add column if not exists ai_key_points text[],
  add column if not exists ai_status text default 'pending';
