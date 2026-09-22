-- 대댓글(답글) 지원: comments 에 parent_id 추가
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
alter table public.comments
  add column if not exists parent_id uuid references public.comments(id) on delete cascade;

create index if not exists comments_parent_idx on public.comments (parent_id);
