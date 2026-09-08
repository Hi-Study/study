-- 009: 커뮤니티 자유글 + 댓글 범용 확장 + 미디어 Storage  [v3.0 P5b]
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.

-- 자유글 (커뮤니티)
create table if not exists public.community_posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles(id) on delete cascade,
  title      text not null,
  body       text not null default '',
  media      text[] not null default '{}',   -- 이미지/영상 URL 배열
  created_at timestamptz not null default now()
);
create index if not exists community_posts_recent_idx on public.community_posts(created_at desc);

alter table public.community_posts enable row level security;
create policy "cp read all"   on public.community_posts for select to authenticated using (true);
create policy "cp insert own" on public.community_posts for insert to authenticated with check (auth.uid() = author_id);
create policy "cp update own" on public.community_posts for update to authenticated using (auth.uid() = author_id);
create policy "cp delete own" on public.community_posts for delete to authenticated using (auth.uid() = author_id);

-- 댓글 범용 확장 (자유글 댓글 지원). 인사이트 댓글은 기존 review_id 유지.
alter table public.comments add column if not exists target_type text not null default 'review';
alter table public.comments add column if not exists target_id uuid;
update public.comments set target_id = review_id where target_id is null;
alter table public.comments alter column review_id drop not null;
create index if not exists comments_target_idx on public.comments(target_type, target_id);

-- 자유글 미디어 Storage 버킷 (public 읽기, 로그인 업로드)
insert into storage.buckets (id, name, public) values ('community', 'community', true)
  on conflict (id) do nothing;
drop policy if exists "community media read"   on storage.objects;
drop policy if exists "community media upload" on storage.objects;
create policy "community media read"   on storage.objects for select using (bucket_id = 'community');
create policy "community media upload" on storage.objects for insert to authenticated with check (bucket_id = 'community');
