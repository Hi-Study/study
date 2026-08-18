-- 토론 참여(가벼운 참여/취소 토글) — 참여 인원 표시 + 참여하기 버튼용.

create table if not exists public.discussion_participants (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  user_key uuid not null references auth.users(id),
  joined_at timestamptz not null default now(),
  unique (article_id, user_key)
);

alter table public.discussion_participants enable row level security;

-- 참여 인원 수는 모두에게 보이는 정보라 select는 로그인한 팀원 전체에 연다.
create policy "discussion_participants_select_all"
  on public.discussion_participants for select
  to authenticated
  using (true);

create policy "discussion_participants_insert_own"
  on public.discussion_participants for insert
  to authenticated
  with check (auth.uid() = user_key);

create policy "discussion_participants_delete_own"
  on public.discussion_participants for delete
  to authenticated
  using (auth.uid() = user_key);
