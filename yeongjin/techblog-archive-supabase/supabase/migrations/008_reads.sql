-- 읽은 아티클 트래킹 (PRD v0.2 4.8, 마이 탭 "읽은 아티클")

create table if not exists public.reads (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  user_key uuid not null references auth.users(id),
  read_at timestamptz not null default now(),
  unique (article_id, user_key)
);

alter table public.reads enable row level security;

create policy "reads_select_own"
  on public.reads for select
  to authenticated
  using (auth.uid() = user_key);

create policy "reads_upsert_own"
  on public.reads for insert
  to authenticated
  with check (auth.uid() = user_key);

create policy "reads_update_own"
  on public.reads for update
  to authenticated
  using (auth.uid() = user_key);
