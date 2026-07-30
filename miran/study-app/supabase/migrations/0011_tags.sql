-- ============================================================
-- 0011 · 태그 (공유 글 / 토론)
-- 검색·필터에서 태그로 거를 수 있게 text[] 배열로 저장.
-- GIN 인덱스로 배열 포함(@>, &&) 검색 가속.
-- ============================================================
alter table public.shares      add column if not exists tags text[] not null default '{}';
alter table public.discussions add column if not exists tags text[] not null default '{}';

create index if not exists idx_shares_tags      on public.shares      using gin (tags);
create index if not exists idx_discussions_tags on public.discussions using gin (tags);
