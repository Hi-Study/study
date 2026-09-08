-- 008: 범용 좋아요 (review_likes + comment_likes 통합)  [v3.0 P5a]
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
-- 구 테이블(review_likes / comment_likes)은 당분간 남겨둔다(추후 정리).

create table if not exists public.likes (
  target_type text not null check (target_type in ('review','comment','community_post')),
  target_id   uuid not null,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (target_type, target_id, user_id)
);
create index if not exists likes_target_idx on public.likes(target_type, target_id);

alter table public.likes enable row level security;
create policy "likes read all"   on public.likes for select to authenticated using (true);
create policy "likes insert own" on public.likes for insert to authenticated with check (auth.uid() = user_id);
create policy "likes delete own" on public.likes for delete to authenticated using (auth.uid() = user_id);

-- 기존 좋아요 이관
insert into public.likes (target_type, target_id, user_id)
  select 'review', review_id, user_id from public.review_likes on conflict do nothing;
insert into public.likes (target_type, target_id, user_id)
  select 'comment', comment_id, user_id from public.comment_likes on conflict do nothing;
