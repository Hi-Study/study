-- 댓글 좋아요
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
create table if not exists public.comment_likes (
  comment_id uuid not null references public.comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);
create index if not exists comment_likes_comment_idx on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;
create policy "comment_likes read"       on public.comment_likes for select to authenticated using (true);
create policy "comment_likes insert own" on public.comment_likes for insert to authenticated with check (user_id = auth.uid());
create policy "comment_likes delete own" on public.comment_likes for delete to authenticated using (user_id = auth.uid());
