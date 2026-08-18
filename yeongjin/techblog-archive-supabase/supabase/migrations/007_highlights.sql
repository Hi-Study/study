-- 형광펜 + 개인 메모 (PRD v0.2 4.9) — 공개 범위는 나만 보기로 확정.

create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  user_key uuid not null references auth.users(id),
  quote text not null,
  note text,
  created_at timestamptz not null default now()
);

alter table public.highlights enable row level security;

create policy "highlights_select_own"
  on public.highlights for select
  to authenticated
  using (auth.uid() = user_key);

create policy "highlights_insert_own"
  on public.highlights for insert
  to authenticated
  with check (auth.uid() = user_key);

create policy "highlights_delete_own"
  on public.highlights for delete
  to authenticated
  using (auth.uid() = user_key);
