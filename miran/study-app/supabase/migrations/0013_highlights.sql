-- ============================================================
-- 0013 · 문장 하이라이트 + 감상 코멘트 (피그마 코멘트식)
--   공유 글 본문을 문장 단위로 색칠 + 감상평. 모든 멤버에게 공유됨.
--   sentence_index = 본문을 splitSentences 로 나눈 조각의 순번(모든 클라 동일).
--   유저당 (글, 문장) 하나 → color/note 갱신(upsert).
-- ============================================================
create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  share_id uuid not null references public.shares(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  sentence_index int not null,
  quote text,
  color text not null default 'yellow',
  note text,
  created_at timestamptz not null default now(),
  unique (author_id, share_id, sentence_index)
);
create index if not exists idx_highlights_share on public.highlights(share_id);

alter table public.highlights enable row level security;

drop policy if exists hl_select_member on public.highlights;
create policy hl_select_member on public.highlights
  for select to authenticated using (public.is_study_member(study_id));

drop policy if exists hl_insert_own on public.highlights;
create policy hl_insert_own on public.highlights
  for insert to authenticated
  with check (public.is_study_member(study_id) and author_id = auth.uid());

drop policy if exists hl_update_own on public.highlights;
create policy hl_update_own on public.highlights
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

drop policy if exists hl_delete_own on public.highlights;
create policy hl_delete_own on public.highlights
  for delete to authenticated using (author_id = auth.uid());
