-- ============================================================
-- 0001 · 테이블 · 인덱스
-- 출처: dev/schema.md 를 1:1 이식. 아래 두 컬럼은 RLS 강제/성능을 위한
-- 의도적 추가이며 supabase/README.md 에 명시되어 있습니다:
--   · comments.study_id  (target 해석 없이 멤버십 검사)
--   · likes.study_id     (동상)
--   · shares.ai_summary  (dev/api.md §3 AI 요약 캐시 컬럼)
-- ============================================================

-- 사용자 프로필 (auth.users 와 1:1)
create table if not exists public.users (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '게스트',
  role_title text,                       -- 직급/역할 (예: PM)
  theme text not null default 'light',   -- 'light' | 'dark' (화면 설정)
  created_at timestamptz not null default now()
);

-- 스터디
create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.users(id),
  invite_code char(6) not null unique,   -- 랜덤 6자(혼동문자 제외). 만료 없음
  share_cadence text not null default '주 2회', -- 매일 1회 / 주 2회 / 주 3회 / 주 5회
  created_at timestamptz not null default now()
);

-- 멤버십 + 권한
create table if not exists public.study_members (
  study_id uuid not null references public.studies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',   -- 'owner' | 'member'
  joined_at timestamptz not null default now(),
  primary key (study_id, user_id)
);

-- 공유 글 (링크 or 직접작성)
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  kind text not null check (kind in ('link','text')),
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=월 … 6=일
  shared_date date not null,
  title text not null,
  url text,                              -- link
  source text,                           -- 도메인
  og_image text,
  og_description text,                   -- 서버가 채움
  body text,                             -- text (직접작성)
  note text,                             -- link 메모/본문
  image_urls text[],                     -- 직접 작성 글 첨부(Storage). link는 og_image
  ai_summary text,                       -- [추가] AI 요약 캐시 (dev/api.md §3)
  created_at timestamptz not null default now()
);

-- 토론 (링크 or 직접), 방장 결론
create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  week_label text not null,              -- 표시용 "7월 셋째 주"
  week_start date not null,              -- 그 주 월요일(정렬/월 이동 필터)
  title text not null,
  prompt text,                           -- 여는 글 요약
  body text,                             -- 여는 글 본문
  kind text not null default 'text' check (kind in ('link','text')),
  url text,
  source text,
  og_image text,
  is_active boolean not null default true,
  conclusion_comment_id uuid,            -- 방장이 지정한 결론 (comments.id) — FK는 아래서
  created_at timestamptz not null default now()
);

-- 댓글 + 대댓글(parent_id) — 공유글/토론 공용
-- [추가] study_id 를 비정규화해 RLS 멤버십 검사를 단순/안전하게 함.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  target_type text not null check (target_type in ('share','discussion')),
  target_id uuid not null,
  parent_id uuid references public.comments(id) on delete cascade, -- null=최상위
  author_id uuid references public.users(id) on delete set null,
  text text not null,
  quote text,                            -- 인용 원문(대댓글)
  created_at timestamptz not null default now()
);

-- discussions.conclusion_comment_id → comments.id (테이블 정의 후 순환참조 해소)
-- 재실행 안전을 위해 drop if exists 후 재생성.
alter table public.discussions drop constraint if exists discussions_conclusion_fk;
alter table public.discussions
  add constraint discussions_conclusion_fk
  foreign key (conclusion_comment_id) references public.comments(id)
  on delete set null;

-- 좋아요/공감 (공유글, 댓글, 토론 여는 글)
-- [추가] study_id 비정규화 — likes 만으로 멤버십 검사 가능.
create table if not exists public.likes (
  user_id uuid not null references public.users(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  target_type text not null check (target_type in ('share','comment','discussion')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

-- 알림
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in
    ('discussion_pending','cadence','comment','reply','member_joined')),
  study_id uuid,
  ref_id uuid,
  text text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------- 인덱스 ----------------
create index if not exists idx_members_user on public.study_members(user_id);
create index if not exists idx_shares_study_date on public.shares(study_id, shared_date);
create index if not exists idx_shares_study_created on public.shares(study_id, created_at desc);
create index if not exists idx_disc_study_week on public.discussions(study_id, week_start);
create index if not exists idx_comments_target on public.comments(target_type, target_id, created_at);
create index if not exists idx_comments_study on public.comments(study_id);
create index if not exists idx_comments_parent on public.comments(parent_id);
create index if not exists idx_likes_target on public.likes(target_type, target_id);
create index if not exists idx_likes_study on public.likes(study_id);
create index if not exists idx_notif_user on public.notifications(user_id, is_read, created_at desc);
