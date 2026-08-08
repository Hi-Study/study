-- 인사이트 공유 서비스 — DB 스키마
-- Supabase SQL Editor에 통째로 붙여넣어 실행하세요.
-- (구글 로그인만 지원 · 초대코드 없음)

create extension if not exists "pgcrypto";

-- ============================================================
-- 0) 초기화 — 재실행 시 깨끗한 상태로 만듭니다.
--    ⚠️ 이 스크립트를 실행하면 아래 테이블의 기존 데이터는 삭제됩니다.
--    (개발 초기 단계 기준 · 실서비스 데이터가 생긴 뒤에는 이 블록을 지우고 마이그레이션으로 관리)
-- ============================================================
drop table if exists public.notifications cascade;
drop table if exists public.reads         cascade;
drop table if exists public.highlights    cascade;
drop table if exists public.favorites     cascade;
drop table if exists public.bookmarks     cascade;
drop table if exists public.comments      cascade;
drop table if exists public.reviews       cascade;
drop table if exists public.posts         cascade;
drop table if exists public.companies     cascade;
drop table if exists public.profiles      cascade;
-- 옛 어노테이션 스키마 잔재 제거
drop table if exists public.invite_codes  cascade;
drop table if exists public.drafts        cascade;
drop table if exists public.talks         cascade;

-- ============================================================
-- 1) 유저 (구글 로그인 시 자동 생성)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  initial text not null,
  avatar_color text not null default '#4F46E5',
  created_at timestamptz not null default now()
);

-- 구글 로그인으로 새 유저 생성 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger as $$
declare
  display text;
begin
  display := coalesce(
    new.raw_user_meta_data->>'name',
    new.raw_user_meta_data->>'full_name',
    split_part(new.email, '@', 1),
    '사용자'
  );
  insert into public.profiles (id, name, initial)
  values (new.id, display, left(display, 1))
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 이미 가입돼 있던 유저(초기화로 프로필이 지워진 경우) 프로필 복구
insert into public.profiles (id, name, initial)
select u.id,
       coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), '사용자'),
       left(coalesce(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1), '사'), 1)
from auth.users u
on conflict (id) do nothing;

-- ============================================================
-- 2) 기업 (기술 블로그 출처)
-- ============================================================
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  color text not null default '#666666',
  domain text,
  rss_url text,
  created_at timestamptz not null default now()
);

insert into public.companies (slug, name, color, domain, rss_url) values
  ('toss',   '토스',           '#3182F6', 'toss.tech',                'https://toss.tech/rss.xml'),
  ('woowa',  '우아한형제들',   '#2AC1BC', 'techblog.woowahan.com',    'https://techblog.woowahan.com/feed/'),
  ('kakao',  '카카오',         '#111111', 'tech.kakao.com',           'https://tech.kakao.com/feed/'),
  ('daangn', '당근',           '#FF7E36', 'medium.com/daangn',        'https://medium.com/feed/daangn'),
  ('naver',  '네이버 D2',      '#03C75A', 'd2.naver.com',             'https://d2.naver.com/d2.atom'),
  ('line',   '라인',           '#06C755', 'techblog.lycorp.co.jp',    'https://techblog.lycorp.co.jp/ko/feed/index.xml')
on conflict (slug) do nothing;

-- ============================================================
-- 3) 글 (자동 수집 or 직접 등록)
-- ============================================================
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid references public.companies(id) on delete set null,
  title text not null,
  url text,
  category text not null default '기술' check (category in ('프로덕트','디자인','기술','AI')),
  tags text[] not null default '{}',
  source text not null default 'crawl' check (source in ('crawl','direct')),
  author_id uuid references public.profiles(id) on delete set null, -- 직접 등록자 (자동수집이면 null)
  ai_summary jsonb not null default '{}'::jsonb,  -- {problem, solution, learning}
  body jsonb not null default '[]'::jsonb,         -- 원문 문장 배열 (파싱 성공 시)
  parsed boolean not null default false,           -- 원문 파싱 여부 (하이라이트 가능 여부)
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
-- 최신순 정렬 / 필터 인덱스
create index if not exists posts_published_idx on public.posts (published_at desc);
create index if not exists posts_company_idx on public.posts (company_id);
create index if not exists posts_category_idx on public.posts (category);
-- URL 중복 확인용 (직접 등록 시 이미 있는 글인지 판별)
create unique index if not exists posts_url_key on public.posts (url) where url is not null;

-- ============================================================
-- 4) 독후감 (서비스 핵심 콘텐츠 · 3문항)
-- ============================================================
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  q1 text not null default '',  -- 인상 깊은 부분
  q2 text not null default '',  -- 업무 적용
  q3 text not null default '',  -- 인사이터에게 질문
  is_draft boolean not null default false,  -- 임시저장(작성중)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (post_id, author_id),  -- 글당 유저 1개 독후감
  -- 게시본은 3문항 중 최소 1개 필수 (임시저장은 예외)
  constraint review_min_one check (
    is_draft
    or length(trim(q1)) > 0
    or length(trim(q2)) > 0
    or length(trim(q3)) > 0
  )
);
create index if not exists reviews_post_idx on public.reviews (post_id);
create index if not exists reviews_recent_idx on public.reviews (created_at desc);

-- ============================================================
-- 5) 댓글 (독후감에만)
-- ============================================================
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists comments_review_idx on public.comments (review_id);

-- ============================================================
-- 6) 유저별 상태: 북마크 / 기업 즐겨찾기 / 하이라이트 / 다읽음
-- ============================================================
create table if not exists public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.favorites (
  user_id uuid not null references public.profiles(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, company_id)
);

-- 하이라이트/메모 (나만 보기)
create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  sentence_idx int not null,
  memo text,
  created_at timestamptz not null default now(),
  unique (user_id, post_id, sentence_idx)
);
create index if not exists highlights_user_idx on public.highlights (user_id);

-- 다 읽음 (상세 스크롤 90% 도달 시)
create table if not exists public.reads (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ============================================================
-- 7) 알림
-- ============================================================
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('new_post','comment')),
  title text not null,
  body text not null default '',
  post_id uuid references public.posts(id) on delete cascade,
  review_id uuid references public.reviews(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);

-- ============================================================
-- 8) Row Level Security
--    로그인 유저는 공용 콘텐츠 읽기 가능, 쓰기는 본인 것만.
--    (자동 수집 글은 서비스 롤 키로 삽입 → RLS 우회)
-- ============================================================
alter table public.profiles      enable row level security;
alter table public.companies     enable row level security;
alter table public.posts         enable row level security;
alter table public.reviews       enable row level security;
alter table public.comments      enable row level security;
alter table public.bookmarks     enable row level security;
alter table public.favorites     enable row level security;
alter table public.highlights    enable row level security;
alter table public.reads         enable row level security;
alter table public.notifications enable row level security;

-- 읽기: 로그인 유저 공통
create policy "profiles read"  on public.profiles  for select to authenticated using (true);
create policy "companies read" on public.companies for select to authenticated using (true);
create policy "posts read"     on public.posts     for select to authenticated using (true);
create policy "reviews read"   on public.reviews   for select to authenticated using (true);
create policy "comments read"  on public.comments  for select to authenticated using (true);

-- 프로필: 본인만 수정
create policy "profiles update own" on public.profiles for update to authenticated using (id = auth.uid());

-- 글: 직접 등록만 본인 명의로 insert / 본인 것 수정·삭제
create policy "posts insert own" on public.posts for insert to authenticated with check (author_id = auth.uid() and source = 'direct');
create policy "posts update own" on public.posts for update to authenticated using (author_id = auth.uid());
create policy "posts delete own" on public.posts for delete to authenticated using (author_id = auth.uid());

-- 독후감: 본인 것만 쓰기/수정/삭제
create policy "reviews insert own" on public.reviews for insert to authenticated with check (author_id = auth.uid());
create policy "reviews update own" on public.reviews for update to authenticated using (author_id = auth.uid());
create policy "reviews delete own" on public.reviews for delete to authenticated using (author_id = auth.uid());

-- 댓글: 본인 것만
create policy "comments insert own" on public.comments for insert to authenticated with check (author_id = auth.uid());
create policy "comments update own" on public.comments for update to authenticated using (author_id = auth.uid());
create policy "comments delete own" on public.comments for delete to authenticated using (author_id = auth.uid());

-- 북마크 / 즐겨찾기 / 다읽음: 본인 것만 (읽기·쓰기 모두)
create policy "bookmarks own" on public.bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "favorites own" on public.favorites for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reads own"     on public.reads     for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 하이라이트/메모: 나만 보기 (본인 것만 읽기·쓰기)
create policy "highlights own" on public.highlights for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 알림: 본인 것만 읽기/수정, 생성은 로그인 유저 (트리거/서버에서)
create policy "notifications select own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications update own" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "notifications insert"     on public.notifications for insert to authenticated with check (true);
