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
