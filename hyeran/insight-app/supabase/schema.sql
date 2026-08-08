-- 어노테이션 DB 스키마
-- Supabase SQL Editor에서 실행

create extension if not exists "pgcrypto";

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  initial text not null,
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, initial)
  values (
    new.id,
    coalesce(split_part(new.email, '@', 1), '사용자'),
    left(coalesce(split_part(new.email, '@', 1), '사'), 1)
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- invite codes ----------
create table if not exists public.invite_codes (
  code text primary key,
  group_name text not null default '기획자 스터디',
  created_at timestamptz not null default now()
);

insert into public.invite_codes (code, group_name)
values ('PLANNER2026', '기획자 스터디')
on conflict (code) do nothing;

-- ---------- posts ----------
create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  source text not null,
  url text,
  sharer_id uuid not null references public.profiles(id),
  icon text not null default 'link',
  tags text[] not null default '{}',
  paragraphs jsonb not null default '[]',
  ai_summary text not null default '',
  terms jsonb not null default '[]',
  reader_take jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------- highlights ----------
create table if not exists public.highlights (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  owner_id uuid not null references public.profiles(id),
  para_idx int not null,
  text text not null,
  created_at timestamptz not null default now()
);

-- ---------- comments ----------
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  highlight_id uuid not null references public.highlights(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  text text not null,
  created_at timestamptz not null default now()
);

-- ---------- bookmarks ----------
create table if not exists public.bookmarks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ---------- talks ("얘기하고 싶어요") ----------
create table if not exists public.talks (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

-- ---------- drafts ----------
create table if not exists public.drafts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  source text not null,
  url text,
  step int not null default 1,
  paragraphs jsonb not null default '[]',
  highlights jsonb not null default '[]',
  comments jsonb not null default '{}',
  reason_form jsonb not null default '{"thoughts":"","apply":"","other":""}',
  tags text[] not null default '{}',
  updated_at timestamptz not null default now()
);

-- ---------- notifications ----------
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null,
  snippet text not null default '',
  post_id uuid references public.posts(id) on delete cascade,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ================= Row Level Security =================
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.highlights enable row level security;
alter table public.comments enable row level security;
alter table public.bookmarks enable row level security;
alter table public.talks enable row level security;
alter table public.drafts enable row level security;
alter table public.notifications enable row level security;
alter table public.invite_codes enable row level security;

-- everyone signed in can read the closed-group content
create policy "profiles readable by authenticated" on public.profiles for select to authenticated using (true);
create policy "posts readable by authenticated" on public.posts for select to authenticated using (true);
create policy "highlights readable by authenticated" on public.highlights for select to authenticated using (true);
create policy "comments readable by authenticated" on public.comments for select to authenticated using (true);
create policy "invite codes readable by anon" on public.invite_codes for select to anon, authenticated using (true);

-- writes are scoped to the acting user
create policy "posts insert own" on public.posts for insert to authenticated with check (sharer_id = auth.uid());
create policy "posts update own" on public.posts for update to authenticated using (sharer_id = auth.uid());
create policy "posts delete own" on public.posts for delete to authenticated using (sharer_id = auth.uid());

create policy "highlights insert own" on public.highlights for insert to authenticated with check (owner_id = auth.uid());
create policy "highlights delete own" on public.highlights for delete to authenticated using (owner_id = auth.uid());

create policy "comments insert own" on public.comments for insert to authenticated with check (user_id = auth.uid());
create policy "comments delete own" on public.comments for delete to authenticated using (user_id = auth.uid());

create policy "bookmarks all own" on public.bookmarks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "talks all own" on public.talks for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "bookmarks readable by authenticated" on public.bookmarks for select to authenticated using (true);
create policy "talks readable by authenticated" on public.talks for select to authenticated using (true);

create policy "drafts all own" on public.drafts for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications select own" on public.notifications for select to authenticated using (user_id = auth.uid());
create policy "notifications update own" on public.notifications for update to authenticated using (user_id = auth.uid());
create policy "notifications insert authenticated" on public.notifications for insert to authenticated with check (true);
