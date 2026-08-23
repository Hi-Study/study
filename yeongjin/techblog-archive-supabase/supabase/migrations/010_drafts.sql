-- 임시저장 (PRD v0.2 4.8, 마이 탭 "임시저장")

create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_key uuid not null references auth.users(id),
  data jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.drafts enable row level security;

create policy "drafts_select_own"
  on public.drafts for select
  to authenticated
  using (auth.uid() = user_key);

create policy "drafts_insert_own"
  on public.drafts for insert
  to authenticated
  with check (auth.uid() = user_key);

create policy "drafts_update_own"
  on public.drafts for update
  to authenticated
  using (auth.uid() = user_key);

create policy "drafts_delete_own"
  on public.drafts for delete
  to authenticated
  using (auth.uid() = user_key);
