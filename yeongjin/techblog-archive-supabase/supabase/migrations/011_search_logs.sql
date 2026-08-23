-- 급상승 검색어 집계용 로그 (PRD v0.2 4.7)

create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  query text not null,
  created_at timestamptz not null default now()
);

alter table public.search_logs enable row level security;

-- 검색어 집계는 팀 전체가 함께 보는 데이터라 개인 소유가 없다. 로그인한 팀원이면 누구나 기록/조회 가능.
create policy "search_logs_select_all"
  on public.search_logs for select
  to authenticated
  using (true);

create policy "search_logs_insert_all"
  on public.search_logs for insert
  to authenticated
  with check (true);
