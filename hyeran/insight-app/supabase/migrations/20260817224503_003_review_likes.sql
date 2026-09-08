-- 인사이트(리뷰) 좋아요
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
create table if not exists public.review_likes (
  review_id  uuid not null references public.reviews(id)  on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
create index if not exists review_likes_review_idx  on public.review_likes(review_id);
create index if not exists review_likes_created_idx on public.review_likes(created_at desc);

alter table public.review_likes enable row level security;
create policy "review_likes read"       on public.review_likes for select to authenticated using (true);
create policy "review_likes insert own" on public.review_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "review_likes delete own" on public.review_likes for delete to authenticated using (auth.uid() = user_id);
