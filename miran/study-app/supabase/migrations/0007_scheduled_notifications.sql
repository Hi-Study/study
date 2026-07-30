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
