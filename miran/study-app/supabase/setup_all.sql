-- ============================================================
-- 기획 스터디 — Supabase 전체 설정 SQL (한 번에 실행)
-- 재실행 안전(idempotent): 지우고 통째로 다시 붙여넣어 Run 해도 에러 없음.
-- 0004 알림트리거 · 0005 이미지 · 0006 본문캐시 · 0007 스케줄알림 · 0008 토론요약
-- ============================================================
-- ####################  0001_init_tables.sql  ####################
-- ============================================================
-- 0001 · 테이블 · 인덱스
-- 출처: dev/schema.md 를 1:1 이식. 아래 두 컬럼은 RLS 강제/성능을 위한
-- 의도적 추가이며 supabase/README.md 에 명시되어 있습니다:
--   · comments.study_id  (target 해석 없이 멤버십 검사)
--   · likes.study_id     (동상)
--   · shares.ai_summary  (dev/api.md §3 AI 요약 캐시 컬럼)
-- ============================================================

-- 사용자 프로필 (auth.users 와 1:1)
create table if not exists public.users (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '게스트',
  role_title text,                       -- 직급/역할 (예: PM)
  theme text not null default 'light',   -- 'light' | 'dark' (화면 설정)
  created_at timestamptz not null default now()
);

-- 스터디
create table if not exists public.studies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references public.users(id),
  invite_code char(6) not null unique,   -- 랜덤 6자(혼동문자 제외). 만료 없음
  share_cadence text not null default '주 2회', -- 매일 1회 / 주 2회 / 주 3회 / 주 5회
  created_at timestamptz not null default now()
);

-- 멤버십 + 권한
create table if not exists public.study_members (
  study_id uuid not null references public.studies(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  role text not null default 'member',   -- 'owner' | 'member'
  joined_at timestamptz not null default now(),
  primary key (study_id, user_id)
);

-- 공유 글 (링크 or 직접작성)
create table if not exists public.shares (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  kind text not null check (kind in ('link','text')),
  day_of_week int not null check (day_of_week between 0 and 6), -- 0=월 … 6=일
  shared_date date not null,
  title text not null,
  url text,                              -- link
  source text,                           -- 도메인
  og_image text,
  og_description text,                   -- 서버가 채움
  body text,                             -- text (직접작성)
  note text,                             -- link 메모/본문
  image_urls text[],                     -- 직접 작성 글 첨부(Storage). link는 og_image
  ai_summary text,                       -- [추가] AI 요약 캐시 (dev/api.md §3)
  created_at timestamptz not null default now()
);

-- 토론 (링크 or 직접), 방장 결론
create table if not exists public.discussions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  week_label text not null,              -- 표시용 "7월 셋째 주"
  week_start date not null,              -- 그 주 월요일(정렬/월 이동 필터)
  title text not null,
  prompt text,                           -- 여는 글 요약
  body text,                             -- 여는 글 본문
  kind text not null default 'text' check (kind in ('link','text')),
  url text,
  source text,
  og_image text,
  is_active boolean not null default true,
  conclusion_comment_id uuid,            -- 방장이 지정한 결론 (comments.id) — FK는 아래서
  created_at timestamptz not null default now()
);

-- 댓글 + 대댓글(parent_id) — 공유글/토론 공용
-- [추가] study_id 를 비정규화해 RLS 멤버십 검사를 단순/안전하게 함.
create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  study_id uuid not null references public.studies(id) on delete cascade,
  target_type text not null check (target_type in ('share','discussion')),
  target_id uuid not null,
  parent_id uuid references public.comments(id) on delete cascade, -- null=최상위
  author_id uuid references public.users(id) on delete set null,
  text text not null,
  quote text,                            -- 인용 원문(대댓글)
  created_at timestamptz not null default now()
);

-- discussions.conclusion_comment_id → comments.id (테이블 정의 후 순환참조 해소)
-- 재실행 안전을 위해 drop if exists 후 재생성.
alter table public.discussions drop constraint if exists discussions_conclusion_fk;
alter table public.discussions
  add constraint discussions_conclusion_fk
  foreign key (conclusion_comment_id) references public.comments(id)
  on delete set null;

-- 좋아요/공감 (공유글, 댓글, 토론 여는 글)
-- [추가] study_id 비정규화 — likes 만으로 멤버십 검사 가능.
create table if not exists public.likes (
  user_id uuid not null references public.users(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  target_type text not null check (target_type in ('share','comment','discussion')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

-- 알림
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in
    ('discussion_pending','cadence','comment','reply','member_joined')),
  study_id uuid,
  ref_id uuid,
  text text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

-- ---------------- 인덱스 ----------------
create index if not exists idx_members_user on public.study_members(user_id);
create index if not exists idx_shares_study_date on public.shares(study_id, shared_date);
create index if not exists idx_shares_study_created on public.shares(study_id, created_at desc);
create index if not exists idx_disc_study_week on public.discussions(study_id, week_start);
create index if not exists idx_comments_target on public.comments(target_type, target_id, created_at);
create index if not exists idx_comments_study on public.comments(study_id);
create index if not exists idx_comments_parent on public.comments(parent_id);
create index if not exists idx_likes_target on public.likes(target_type, target_id);
create index if not exists idx_likes_study on public.likes(study_id);
create index if not exists idx_notif_user on public.notifications(user_id, is_read, created_at desc);


-- ####################  0002_functions_triggers.sql  ####################
-- ============================================================
-- 0002 · 헬퍼 함수 · 트리거 · RPC
-- 확정 정책(dev/api.md §2, dev/schema.md 확정 정책) 구현.
-- 멤버십 검사 헬퍼는 SECURITY DEFINER 로 study_members 의 RLS 재귀를 회피합니다.
-- ============================================================

-- ---------------- 멤버십 검사 헬퍼 (RLS 에서 사용) ----------------
create or replace function public.is_study_member(_study uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.study_members m
    where m.study_id = _study and m.user_id = auth.uid()
  );
$$;

create or replace function public.is_study_owner(_study uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.study_members m
    where m.study_id = _study
      and m.user_id = auth.uid()
      and m.role = 'owner'
  );
$$;

-- ---------------- 프로필 자동 생성 트리거 ----------------
-- auth.users insert → public.users(name '게스트') 자동 생성 (dev/api.md §1)
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------- 초대 코드 생성 ----------------
-- 혼동문자(0,O,1,I,L) 제외 32진 알파벳에서 6자.
create or replace function public.random_invite_code()
returns char(6)
language plpgsql
volatile
as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  result text := '';
  i int;
begin
  for i in 1..6 loop
    result := result || substr(alphabet, floor(random() * length(alphabet) + 1)::int, 1);
  end loop;
  return result;
end;
$$;

-- ---------------- 스터디 생성 (트랜잭션 RPC) ----------------
-- 랜덤 코드 충돌 시 재시도 루프 (dev/api.md §2 확정규칙 ④).
create or replace function public.create_study(
  _name text,
  _description text,
  _cadence text default '주 2회'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_study_id uuid;
  v_code char(6);
  v_attempt int := 0;
begin
  if v_uid is null then
    raise exception '인증되지 않은 요청입니다.' using errcode = '42501';
  end if;
  if coalesce(btrim(_name), '') = '' then
    raise exception '스터디 이름은 필수입니다.' using errcode = '22000';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := public.random_invite_code();
    begin
      insert into public.studies (name, description, owner_id, invite_code, share_cadence)
      values (btrim(_name), _description, v_uid, v_code, coalesce(_cadence, '주 2회'))
      returning id into v_study_id;
      exit; -- 성공
    exception when unique_violation then
      if v_attempt >= 10 then
        raise exception '초대 코드 생성에 실패했습니다. 다시 시도하세요.';
      end if;
      -- 코드 충돌 → 재시도
    end;
  end loop;

  insert into public.study_members (study_id, user_id, role)
  values (v_study_id, v_uid, 'owner');

  return v_study_id;
end;
$$;

-- ---------------- 코드로 참여 ----------------
-- 이미 참여 중이면 에러 아닌 안내(status='already_member') 반환 (dev/api.md §2 ①).
create or replace function public.join_by_code(_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_study_id uuid;
begin
  if v_uid is null then
    raise exception '인증되지 않은 요청입니다.' using errcode = '42501';
  end if;

  select id into v_study_id
  from public.studies
  where invite_code = upper(btrim(_code));

  if v_study_id is null then
    raise exception '유효하지 않은 초대 코드입니다.' using errcode = 'P0002';
  end if;

  if exists (
    select 1 from public.study_members
    where study_id = v_study_id and user_id = v_uid
  ) then
    return jsonb_build_object('status', 'already_member', 'study_id', v_study_id);
  end if;

  insert into public.study_members (study_id, user_id, role)
  values (v_study_id, v_uid, 'member');

  return jsonb_build_object('status', 'joined', 'study_id', v_study_id);
end;
$$;

-- ---------------- 방장 위임 ----------------
create or replace function public.delegate_owner(_study uuid, _target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not public.is_study_owner(_study) then
    raise exception '방장만 위임할 수 있습니다.' using errcode = '42501';
  end if;
  if _target = v_uid then
    raise exception '자기 자신에게는 위임할 수 없습니다.';
  end if;
  if not exists (
    select 1 from public.study_members
    where study_id = _study and user_id = _target
  ) then
    raise exception '대상이 스터디 멤버가 아닙니다.';
  end if;

  update public.studies set owner_id = _target where id = _study;
  update public.study_members set role = 'owner'
    where study_id = _study and user_id = _target;
  update public.study_members set role = 'member'
    where study_id = _study and user_id = v_uid;
end;
$$;

-- ---------------- 스터디 나가기 ----------------
-- 방장이면 가장 오래된 다른 멤버(joined_at 최소)에 자동 위임 후 퇴장,
-- 마지막 멤버면 스터디 삭제 (dev/api.md §2 ③).
create or replace function public.leave_study(_study uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
  v_heir uuid;
begin
  select role into v_role
  from public.study_members
  where study_id = _study and user_id = v_uid;

  if v_role is null then
    raise exception '해당 스터디의 멤버가 아닙니다.';
  end if;

  if v_role = 'owner' then
    select user_id into v_heir
    from public.study_members
    where study_id = _study and user_id <> v_uid
    order by joined_at asc, user_id asc
    limit 1;

    if v_heir is null then
      -- 마지막 멤버 → 스터디 삭제 (cascade)
      delete from public.studies where id = _study;
      return;
    end if;

    -- 후계자에게 위임 후 퇴장
    update public.studies set owner_id = v_heir where id = _study;
    update public.study_members set role = 'owner'
      where study_id = _study and user_id = v_heir;
  end if;

  delete from public.study_members
  where study_id = _study and user_id = v_uid;
end;
$$;

-- ---------------- 초대 코드 재발급 ----------------
-- 방장만. 만료 없음 — 재발급 시에만 기존 코드 무효 (dev/schema.md 확정 정책).
create or replace function public.regenerate_invite_code(_study uuid)
returns char(6)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code char(6);
  v_attempt int := 0;
begin
  if not public.is_study_owner(_study) then
    raise exception '방장만 코드를 재발급할 수 있습니다.' using errcode = '42501';
  end if;

  loop
    v_attempt := v_attempt + 1;
    v_code := public.random_invite_code();
    begin
      update public.studies set invite_code = v_code where id = _study;
      exit;
    exception when unique_violation then
      if v_attempt >= 10 then
        raise exception '코드 재발급에 실패했습니다. 다시 시도하세요.';
      end if;
    end;
  end loop;

  return v_code;
end;
$$;

-- ---------------- 실행 권한 ----------------
grant execute on function
  public.create_study(text, text, text),
  public.join_by_code(text),
  public.delegate_owner(uuid, uuid),
  public.leave_study(uuid),
  public.regenerate_invite_code(uuid),
  public.is_study_member(uuid),
  public.is_study_owner(uuid)
to authenticated;


-- ####################  0003_rls_policies.sql  ####################
-- ============================================================
-- 0003 · RLS 활성화 + 정책
-- 규칙 출처: dev/schema.md "RLS 핵심 규칙" + dev/api.md 권한 컬럼.
--
-- 핵심:
--   · study 하위 데이터: 해당 study 멤버만 select/insert  (is_study_member)
--   · studies/멤버/코드 변경: owner 만                    (is_study_owner / RPC)
--   · 본인 글·댓글·좋아요만 수정/삭제. 단 owner 는 스터디 내 모든
--     글/댓글 delete 가능(중재)  (신고 기능 없음)
--   · 멤버 가입/탈퇴/위임은 RPC(SECURITY DEFINER)로만 → 직접 insert/update 미허용
--
-- ⚠️ 재실행 안전(idempotent): 각 정책은 drop if exists 후 재생성.
-- ============================================================

alter table public.users          enable row level security;
alter table public.studies        enable row level security;
alter table public.study_members  enable row level security;
alter table public.shares         enable row level security;
alter table public.discussions    enable row level security;
alter table public.comments       enable row level security;
alter table public.likes          enable row level security;
alter table public.notifications  enable row level security;

-- ---------------- users ----------------
-- 프로필(이름/직급/아바타)은 스터디 전반에서 표시되므로 로그인 사용자 조회 허용.
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated using (true);

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- insert 는 handle_new_user 트리거(SECURITY DEFINER)가 담당. 방어적 self-insert 허용.
drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users
  for insert to authenticated with check (id = auth.uid());

-- ---------------- studies ----------------
drop policy if exists studies_select_member on public.studies;
create policy studies_select_member on public.studies
  for select to authenticated using (public.is_study_member(id));

-- 생성은 create_study RPC 사용 권장. 직접 insert 시에도 owner 는 본인만.
drop policy if exists studies_insert_owner on public.studies;
create policy studies_insert_owner on public.studies
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists studies_update_owner on public.studies;
create policy studies_update_owner on public.studies
  for update to authenticated
  using (public.is_study_owner(id)) with check (public.is_study_owner(id));

drop policy if exists studies_delete_owner on public.studies;
create policy studies_delete_owner on public.studies
  for delete to authenticated using (public.is_study_owner(id));

-- ---------------- study_members ----------------
-- 같은 스터디 멤버끼리 서로의 멤버십 조회 가능 (멤버 목록 화면).
drop policy if exists members_select on public.study_members;
create policy members_select on public.study_members
  for select to authenticated using (public.is_study_member(study_id));

-- 강퇴: owner 가 본인 외 멤버 삭제. (본인 탈퇴는 leave_study RPC 사용)
drop policy if exists members_delete_owner on public.study_members;
create policy members_delete_owner on public.study_members
  for delete to authenticated
  using (public.is_study_owner(study_id) and user_id <> auth.uid());

-- 참여/위임/생성 시 insert·update 는 RPC(SECURITY DEFINER)로만 수행 → 정책 없음.

-- ---------------- shares ----------------
drop policy if exists shares_select_member on public.shares;
create policy shares_select_member on public.shares
  for select to authenticated using (public.is_study_member(study_id));

drop policy if exists shares_insert_member on public.shares;
create policy shares_insert_member on public.shares
  for insert to authenticated
  with check (public.is_study_member(study_id) and author_id = auth.uid());

-- OG/요약 등 서버 채움은 service_role(RLS 우회). 클라는 본인 글만 수정.
drop policy if exists shares_update_own on public.shares;
create policy shares_update_own on public.shares
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- 본인 글 or owner(중재) 삭제.
drop policy if exists shares_delete_own_or_owner on public.shares;
create policy shares_delete_own_or_owner on public.shares
  for delete to authenticated
  using (author_id = auth.uid() or public.is_study_owner(study_id));

-- ---------------- discussions ----------------
drop policy if exists disc_select_member on public.discussions;
create policy disc_select_member on public.discussions
  for select to authenticated using (public.is_study_member(study_id));

drop policy if exists disc_insert_member on public.discussions;
create policy disc_insert_member on public.discussions
  for insert to authenticated
  with check (public.is_study_member(study_id) and author_id = auth.uid());

-- 본인 글 수정, 또는 owner(결론 고정 conclusion_comment_id 지정 등).
drop policy if exists disc_update_own_or_owner on public.discussions;
create policy disc_update_own_or_owner on public.discussions
  for update to authenticated
  using (author_id = auth.uid() or public.is_study_owner(study_id))
  with check (author_id = auth.uid() or public.is_study_owner(study_id));

drop policy if exists disc_delete_own_or_owner on public.discussions;
create policy disc_delete_own_or_owner on public.discussions
  for delete to authenticated
  using (author_id = auth.uid() or public.is_study_owner(study_id));

-- ---------------- comments ----------------
drop policy if exists comments_select_member on public.comments;
create policy comments_select_member on public.comments
  for select to authenticated using (public.is_study_member(study_id));

drop policy if exists comments_insert_member on public.comments;
create policy comments_insert_member on public.comments
  for insert to authenticated
  with check (public.is_study_member(study_id) and author_id = auth.uid());

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- 본인 댓글 or owner(중재) 삭제.
drop policy if exists comments_delete_own_or_owner on public.comments;
create policy comments_delete_own_or_owner on public.comments
  for delete to authenticated
  using (author_id = auth.uid() or public.is_study_owner(study_id));

-- ---------------- likes ----------------
drop policy if exists likes_select_member on public.likes;
create policy likes_select_member on public.likes
  for select to authenticated using (public.is_study_member(study_id));

drop policy if exists likes_insert_own on public.likes;
create policy likes_insert_own on public.likes
  for insert to authenticated
  with check (public.is_study_member(study_id) and user_id = auth.uid());

drop policy if exists likes_delete_own on public.likes;
create policy likes_delete_own on public.likes
  for delete to authenticated using (user_id = auth.uid());

-- ---------------- notifications ----------------
-- 본인 알림만 조회/읽음처리/삭제. insert 는 서버(Edge Function/트리거)가 담당.
drop policy if exists notif_select_own on public.notifications;
create policy notif_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notif_delete_own on public.notifications;
create policy notif_delete_own on public.notifications
  for delete to authenticated using (user_id = auth.uid());


-- ####################  0004_notification_triggers.sql  ####################
-- ============================================================
-- 0004 · 즉시 알림 트리거 (Edge Function 없이 DB 안에서 동작)
-- dev/api.md §5: comment/reply/member_joined 는 insert 트리거로.
-- (discussion_pending·cadence 는 스케줄이라 notify-cron Edge Function 담당)
-- SECURITY DEFINER → notifications insert(RLS 우회) 가능.
-- ============================================================

-- ---------------- 댓글/답글 알림 ----------------
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target_author uuid;
  v_actor_name text;
  v_type text;
  v_msg text;
begin
  select name into v_actor_name from public.users where id = new.author_id;

  if new.parent_id is not null then
    -- 답글 → 부모 댓글 작성자에게
    select author_id into v_target_author from public.comments where id = new.parent_id;
    v_type := 'reply';
    v_msg := coalesce(v_actor_name, '누군가') || '님이 회원님의 의견에 답글을 남겼어요';
  else
    -- 최상위 댓글 → 원 글/토론 작성자에게
    if new.target_type = 'share' then
      select author_id into v_target_author from public.shares where id = new.target_id;
    else
      select author_id into v_target_author from public.discussions where id = new.target_id;
    end if;
    v_type := 'comment';
    v_msg := coalesce(v_actor_name, '누군가') || '님이 회원님의 글에 댓글을 남겼어요';
  end if;

  -- 자기 자신에게는 알림 안 보냄
  if v_target_author is not null and v_target_author <> new.author_id then
    insert into public.notifications (user_id, type, study_id, ref_id, text)
    values (v_target_author, v_type, new.study_id, new.target_id, v_msg);
  end if;

  return new;
end;
$$;

drop trigger if exists on_comment_created on public.comments;
create trigger on_comment_created
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- ---------------- 멤버 참여 알림 ----------------
create or replace function public.notify_on_member_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  select name into v_name from public.users where id = new.user_id;

  -- 기존 멤버 전원에게(본인 제외). 스터디 생성 시 owner 첫 insert 는 대상이 없어 조용.
  insert into public.notifications (user_id, type, study_id, ref_id, text)
  select m.user_id, 'member_joined', new.study_id, new.user_id,
         coalesce(v_name, '새 멤버') || '님이 스터디에 참여했어요'
  from public.study_members m
  where m.study_id = new.study_id and m.user_id <> new.user_id;

  return new;
end;
$$;

drop trigger if exists on_member_joined on public.study_members;
create trigger on_member_joined
  after insert on public.study_members
  for each row execute function public.notify_on_member_joined();


-- ####################  0005_storage.sql  ####################
-- ============================================================
-- 0005 · 이미지 업로드용 Storage 버킷 + 정책
-- 직접 작성 글 사진 첨부(dev/api.md §3). 대시보드에서 만들지 않아도 이 SQL 로 생성됨.
-- "new row violates row-level security policy" 오류는 storage.objects insert 정책 부재 때문 → 아래로 해결.
-- 재실행 안전(idempotent).
-- ============================================================

-- 공개 읽기 버킷 생성
insert into storage.buckets (id, name, public)
values ('share-images', 'share-images', true)
on conflict (id) do nothing;

-- 인증 사용자는 share-images 버킷에 업로드 가능
drop policy if exists "share_images_insert" on storage.objects;
create policy "share_images_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'share-images');

-- 누구나 읽기(공개 이미지 URL)
drop policy if exists "share_images_read" on storage.objects;
create policy "share_images_read" on storage.objects
  for select to public
  using (bucket_id = 'share-images');

-- 본인이 올린 파일만 삭제
drop policy if exists "share_images_delete" on storage.objects;
create policy "share_images_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'share-images' and owner = auth.uid());


-- ####################  0006_article_text.sql  ####################
-- ============================================================
-- 0006 · 링크 원문 본문 캐시 컬럼
-- og-preview / summarize 가 추출한 본문을 저장 → 앱에서 전문 표시 + 요약 품질 향상.
-- ============================================================
alter table public.shares add column if not exists article_text text;


-- ####################  0007_scheduled_notifications.sql  ####################
-- ============================================================
-- 0007 · 스케줄 알림 (Edge Function 없이 순수 SQL + pg_cron)
-- notify-cron 을 배포하지 않고, DB 안에서 함수+스케줄로 처리한다.
--   · discussion_pending : 이번 주 active 토론에 의견 없는 멤버
--   · cadence           : 이번 주 공유 수 < 주기 목표
-- 재실행 안전(idempotent).
-- ============================================================

-- 주기 문자열 → 주당 목표 횟수
create or replace function public.cadence_target(_cadence text)
returns int
language sql
immutable
as $$
  select case
    when _cadence like '%매일%' then 7
    else coalesce(nullif(regexp_replace(coalesce(_cadence,''), '\D', '', 'g'), '')::int, 2)
  end;
$$;

-- 이번 주 미참여/주기 알림 생성 (중복 방지: 같은 주 같은 대상엔 1회)
create or replace function public.generate_scheduled_notifications()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_start date := date_trunc('week', now())::date; -- 이번 주 월요일
  v_end   date := (date_trunc('week', now())::date + 6);
begin
  -- 1) 미참여 토론
  insert into public.notifications (user_id, type, study_id, ref_id, text)
  select sm.user_id, 'discussion_pending', d.study_id, d.id,
         '‘' || d.title || '’ 토론에 아직 의견을 남기지 않았어요'
  from public.discussions d
  join public.study_members sm on sm.study_id = d.study_id
  where d.is_active
    and d.week_start between v_start and v_end
    and not exists (
      select 1 from public.comments c
      where c.target_type = 'discussion' and c.target_id = d.id and c.author_id = sm.user_id
    )
    and not exists (
      select 1 from public.notifications n
      where n.user_id = sm.user_id and n.type = 'discussion_pending'
        and n.ref_id = d.id and n.created_at >= v_start
    );

  -- 2) 공유 주기 미달 — 목표까지 몇 개 남았는지 알려 참여 유도
  insert into public.notifications (user_id, type, study_id, ref_id, text)
  select sm.user_id, 'cadence', s.id, null,
         '이번 주 공유글을 ' || (public.cadence_target(s.share_cadence) - cnt.c)::text
           || '개 더 올리면 이번 주 목표(' || s.share_cadence || ')를 달성해요!'
  from public.studies s
  join public.study_members sm on sm.study_id = s.id
  join lateral (
    select count(*)::int as c
    from public.shares sh
    where sh.study_id = s.id and sh.author_id = sm.user_id
      and sh.shared_date between v_start and v_end
  ) cnt on true
  where cnt.c < public.cadence_target(s.share_cadence)
    and not exists (
      select 1 from public.notifications n
      where n.user_id = sm.user_id and n.type = 'cadence'
        and n.study_id = s.id and n.created_at >= v_start
    );

  -- 3) 지난 주 「토론해요」 최다 공유 글을 토론으로 자동 승격(멱등). 0012 에서 정의.
  perform public.promote_top_shares();
end;
$$;

-- 스케줄 등록 (pg_cron). UTC 기준 — '0 12 * * *' = 한국 21:00.
create extension if not exists pg_cron;

-- 기존 잡 있으면 제거 후 재등록 (재실행 안전)
select cron.unschedule('scheduled-notifications')
where exists (select 1 from cron.job where jobname = 'scheduled-notifications');

select cron.schedule(
  'scheduled-notifications',
  '0 12 * * *',
  $$ select public.generate_scheduled_notifications(); $$
);


-- ####################  0008_discussion_summary.sql  ####################
-- ============================================================
-- 0008 · 토론 AI 요약 캐시 컬럼
-- 주제 + 여는 글 + 의견 + 고정 결론을 종합 요약해 저장.
-- ============================================================
alter table public.discussions add column if not exists ai_summary text;


-- ####################  0009_summary_modes.sql  ####################
-- ============================================================
-- 0009 · 글 요약 3가지 버전(모드별) 캐시
--   ai_summaries = { "plain": ..., "planner": ..., "explain": ... }
--   · plain   = 원문 요약
--   · planner = 기획자 관점(주목할 포인트/적용점)
--   · explain = 비전공자·기획자가 이해하기 쉽게 풀어쓴 버전
-- 공유 글: shares.ai_summaries (본문 요약 3버전)
-- 토론:   discussions.ai_summaries (주제+여는 글 요약 3버전)
--         discussions.ai_summary = 토론 "결과" 요약(의견+결론)으로 계속 사용
-- ============================================================
alter table public.shares      add column if not exists ai_summaries jsonb not null default '{}'::jsonb;
alter table public.discussions add column if not exists ai_summaries jsonb not null default '{}'::jsonb;


-- ####################  0010_discussion_article.sql  ####################
-- ============================================================
-- 0010 · 토론에도 링크 원문 본문/미리보기 캐시(공유 글과 동일하게 전문 표시)
-- ============================================================
alter table public.discussions add column if not exists og_description text;
alter table public.discussions add column if not exists article_text text;


-- ####################  0011_tags.sql  ####################
-- ============================================================
-- 0011 · 태그 (공유 글 / 토론) — 검색·필터용 text[] + GIN 인덱스
-- ============================================================
alter table public.shares      add column if not exists tags text[] not null default '{}';
alter table public.discussions add column if not exists tags text[] not null default '{}';

create index if not exists idx_shares_tags      on public.shares      using gin (tags);
create index if not exists idx_discussions_tags on public.discussions using gin (tags);


-- ####################  0012_discuss_votes.sql  ####################
-- ============================================================
-- 0012 · "토론해요" 투표 + 주간 최다 글 자동 승격(토론 복사)
-- ============================================================
create table if not exists public.discuss_votes (
  user_id uuid not null references public.users(id) on delete cascade,
  study_id uuid not null references public.studies(id) on delete cascade,
  share_id uuid not null references public.shares(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, share_id)
);
create index if not exists idx_discuss_votes_share on public.discuss_votes(share_id);

alter table public.shares add column if not exists promoted_discussion_id uuid;

alter table public.discuss_votes enable row level security;

drop policy if exists dv_select_member on public.discuss_votes;
create policy dv_select_member on public.discuss_votes
  for select to authenticated using (public.is_study_member(study_id));

drop policy if exists dv_insert_own on public.discuss_votes;
create policy dv_insert_own on public.discuss_votes
  for insert to authenticated
  with check (public.is_study_member(study_id) and user_id = auth.uid());

drop policy if exists dv_delete_own on public.discuss_votes;
create policy dv_delete_own on public.discuss_votes
  for delete to authenticated using (user_id = auth.uid());

-- 지난 주(월~일) 최다 "토론해요" 득표 공유 글을 토론으로 복사. 동률이면 전부. 멱등.
create or replace function public.promote_top_shares()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_end   date := date_trunc('week', now())::date - 1;
  v_start date := date_trunc('week', now())::date - 7;
  v_label text := (extract(month from v_start))::int || '월 '
                  || (ceil(extract(day from v_start)::numeric / 7))::int || '째 주';
  r record;
  v_disc uuid;
begin
  for r in
    with wv as (
      select s.*, count(dv.user_id) as votes
      from public.shares s
      left join public.discuss_votes dv on dv.share_id = s.id
      where s.shared_date between v_start and v_end
        and s.promoted_discussion_id is null
      group by s.id
    ),
    mx as (
      select study_id, max(votes) as v from wv where votes > 0 group by study_id
    )
    select wv.* from wv join mx on mx.study_id = wv.study_id and wv.votes = mx.v
  loop
    insert into public.discussions
      (study_id, author_id, week_label, week_start, title, prompt, body, kind,
       url, source, og_image, og_description, article_text, tags)
    values
      (r.study_id, r.author_id, v_label, v_start, r.title,
       '이번 주 「토론해요」가 가장 많았던 공유 글이에요. 함께 이야기해요!',
       coalesce(nullif(r.note, ''), r.body),
       case when r.url is not null then 'link' else 'text' end,
       r.url, r.source, r.og_image, r.og_description, r.article_text, coalesce(r.tags, '{}'))
    returning id into v_disc;

    update public.shares set promoted_discussion_id = v_disc where id = r.id;
  end loop;
end;
$$;

grant execute on function public.promote_top_shares() to authenticated;


-- ####################  0013_highlights.sql  ####################
-- ============================================================
-- 0013 · 문장 하이라이트 + 감상 코멘트 (공유 글 본문을 문장 단위 색칠 + 감상평)
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


-- ####################  0014_share_insight.sql  ####################
-- ============================================================
-- 0014 · 공유 글 "핵심 인사이트" 구조화 입력(링크·직접작성 공통)
--   insight = { core(필수), quote, interpretation, apply, similar, questions[] }
--   note/body 에는 core 를 넣어 목록 미리보기·검색 호환 유지.
-- ============================================================
alter table public.shares add column if not exists insight jsonb;


