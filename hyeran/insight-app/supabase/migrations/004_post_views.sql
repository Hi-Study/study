-- 글 조회 기록 (상세 진입 시)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
create table if not exists public.post_views (
  user_id   uuid not null references public.profiles(id) on delete cascade,
  post_id   uuid not null references public.posts(id)    on delete cascade,
  viewed_at timestamptz not null default now(),
  primary key (user_id, post_id)
);
create index if not exists post_views_recent_idx on public.post_views(user_id, viewed_at desc);

alter table public.post_views enable row level security;
create policy "post_views read own"   on public.post_views for select to authenticated using (auth.uid() = user_id);
create policy "post_views insert own" on public.post_views for insert to authenticated with check (auth.uid() = user_id);
create policy "post_views update own" on public.post_views for update to authenticated using (auth.uid() = user_id);
