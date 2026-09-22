-- 007: 단어장 (리더 하이라이트 '단어' 옵션에서 저장)  [v3.0 P4]
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
create table if not exists public.words (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  term         text not null,
  meaning      text,                                   -- 뜻(선택, 추후 자동 채움)
  post_id      uuid references public.posts(id) on delete set null,  -- 어디서 담았는지
  sentence_idx integer,
  created_at   timestamptz not null default now(),
  unique (user_id, term)                                -- 같은 단어 중복 저장 방지
);
create index if not exists words_user_idx on public.words(user_id, created_at desc);

alter table public.words enable row level security;
create policy "words read own"   on public.words for select to authenticated using (auth.uid() = user_id);
create policy "words insert own" on public.words for insert to authenticated with check (auth.uid() = user_id);
create policy "words delete own" on public.words for delete to authenticated using (auth.uid() = user_id);
