-- 글 등록 (URL 기반 아카이빙 + 필수 등록 노트)

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  title text not null,
  company text not null,
  category text not null,
  thumbnail_url text,
  core_insight text not null,
  tech_knowledge text not null,
  action_point text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

alter table public.articles enable row level security;

create policy "articles_select_all"
  on public.articles for select
  using (true);

-- TEMP: AUTH_REQUIRED=false 로 로그인 없이 미리보기 중이라 anon 등록도 허용한다.
-- 배포 전 이 정책을 지우고 "to authenticated" 정책으로 교체해야 한다.
create policy "articles_insert_preview"
  on public.articles for insert
  with check (true);

create policy "articles_delete_own"
  on public.articles for delete
  to authenticated
  using (auth.uid() = created_by);
