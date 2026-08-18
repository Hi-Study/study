-- 태그·북마크·댓글·검색 (Supabase 복구 후 적용)
-- 지금은 DATA_BACKEND=local 이라 이 마이그레이션은 실행하지 않는다.
-- Supabase 프로젝트를 복구하면: 이 SQL 실행 -> .env.local의 DATA_BACKEND=supabase로 변경.

alter table public.articles
  add column if not exists tags text[] not null default '{}';

create table if not exists public.bookmarks (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  user_key uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (article_id, user_key)
);

alter table public.bookmarks enable row level security;

create policy "bookmarks_select_own"
  on public.bookmarks for select
  to authenticated
  using (auth.uid() = user_key);

create policy "bookmarks_insert_own"
  on public.bookmarks for insert
  to authenticated
  with check (auth.uid() = user_key);

create policy "bookmarks_delete_own"
  on public.bookmarks for delete
  to authenticated
  using (auth.uid() = user_key);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  parent_id uuid references public.comments(id) on delete cascade,
  author_name text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.comments enable row level security;

create policy "comments_select_all"
  on public.comments for select
  using (true);

create policy "comments_insert_authenticated"
  on public.comments for insert
  to authenticated
  with check (true);

-- 검색: 한국어 아티클 검색은 native FTS(to_tsvector)만으로는 정확도가 낮으므로
-- Supabase 대시보드 Extensions에서 PGroonga를 켠 뒤 아래 인덱스를 추가한다.
-- create extension if not exists pgroonga;
-- create index articles_title_pgroonga on public.articles using pgroonga (title);

create index if not exists articles_category_idx on public.articles (category);
create index if not exists bookmarks_article_idx on public.bookmarks (article_id);
create index if not exists comments_article_idx on public.comments (article_id);
