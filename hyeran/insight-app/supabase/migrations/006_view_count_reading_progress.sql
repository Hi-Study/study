-- 006: 조회수(총합) + 이어읽기 진행률  [v3.0 P0]
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.

-- 1) posts.view_count — 총 조회수 (상세 진입 시마다 +1, 카드 대표 지표)
alter table public.posts add column if not exists view_count integer not null default 0;

-- 상세 진입 시 호출할 원자적 증가 함수 (RLS 우회 위해 SECURITY DEFINER)
create or replace function public.increment_view_count(p_post_id uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.posts set view_count = view_count + 1 where id = p_post_id;
$$;
grant execute on function public.increment_view_count(uuid) to authenticated;

-- 2) reading_progress — 이어읽기 (마지막으로 읽던 위치: 본문 블록 인덱스)
create table if not exists public.reading_progress (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  post_id    uuid not null references public.posts(id)    on delete cascade,
  block_idx  integer not null default 0,   -- 원문 리더 블록 인덱스(뷰포트 무관하게 재현 가능)
  updated_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists reading_progress_recent_idx on public.reading_progress(user_id, updated_at desc);

alter table public.reading_progress enable row level security;
create policy "reading_progress read own"   on public.reading_progress for select to authenticated using (auth.uid() = user_id);
create policy "reading_progress insert own" on public.reading_progress for insert to authenticated with check (auth.uid() = user_id);
create policy "reading_progress update own" on public.reading_progress for update to authenticated using (auth.uid() = user_id);
