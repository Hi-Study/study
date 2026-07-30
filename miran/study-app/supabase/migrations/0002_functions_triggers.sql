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
