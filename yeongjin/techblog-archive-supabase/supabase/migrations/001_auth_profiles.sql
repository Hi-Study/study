-- 팀원 프로필 + 회원가입 자동 연결 + 기본 RLS

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- 로그인한 모든 팀원은 서로의 프로필을 볼 수 있다 (팀 전용 서비스이므로)
create policy "profiles_select_authenticated"
  on public.profiles for select
  to authenticated
  using (true);

-- 본인 프로필만 수정할 수 있다
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 회원가입 시 profiles 행을 자동으로 만든다
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
