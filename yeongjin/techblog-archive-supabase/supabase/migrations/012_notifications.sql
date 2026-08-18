-- 기업 좋아요(팔로우) + 알림 (PRD v0.2 2. 공통 UI 헤더)

create table if not exists public.company_follows (
  id uuid primary key default gen_random_uuid(),
  user_key uuid not null references auth.users(id),
  company text not null,
  created_at timestamptz not null default now(),
  unique (user_key, company)
);

alter table public.company_follows enable row level security;

-- 새 글 알림 발송 대상(팔로워)을 계산하려면 다른 사용자의 팔로우 행도 읽어야 한다.
-- 서비스 롤 키를 쓰지 않는 소규모 팀 전용 서비스라, select는 로그인한 팀원 전체에게 열어둔다.
create policy "company_follows_select_all"
  on public.company_follows for select
  to authenticated
  using (true);

create policy "company_follows_insert_own"
  on public.company_follows for insert
  to authenticated
  with check (auth.uid() = user_key);

create policy "company_follows_delete_own"
  on public.company_follows for delete
  to authenticated
  using (auth.uid() = user_key);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_key uuid not null references auth.users(id),
  type text not null check (type in ('new_article', 'note_comment', 'reply')),
  message text not null,
  article_id uuid not null references public.articles(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select
  to authenticated
  using (auth.uid() = user_key);

create policy "notifications_update_own"
  on public.notifications for update
  to authenticated
  using (auth.uid() = user_key);

-- 알림은 다른 사용자에게 발송하는 용도라 작성자(auth.uid())가 아닌 수신자 기준으로 삽입된다.
-- 서비스 롤 키가 없는 구성이라 로그인한 팀원이면 누구나(트리거 로직을 통해서만) 삽입 가능하게 연다.
create policy "notifications_insert_any_authenticated"
  on public.notifications for insert
  to authenticated
  with check (true);
