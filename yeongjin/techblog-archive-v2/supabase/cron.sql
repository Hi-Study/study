-- INSIGHT. 자동 수집 예약 — 서비스를 배포한 "뒤에" Supabase SQL Editor 에서 실행한다.
-- 아래 두 값을 바꿔서 실행:  <배포 주소>  예) https://insight-xxxx.vercel.app (끝에 / 없이)
--                           <CRON_SECRET> 배포 서버 환경변수 CRON_SECRET 과 같은 값
-- 다시 실행해도 안전하다(같은 이름의 비밀값·예약을 지우고 새로 만든다).

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 1) 주소와 비밀값은 Vault(암호화 저장소)에 넣고 예약 작업이 꺼내 쓴다 — SQL 기록에 비밀값이 남지 않게
delete from vault.secrets where name in ('insight_base_url', 'insight_cron_secret');
select vault.create_secret('<배포 주소>', 'insight_base_url');
select vault.create_secret('<CRON_SECRET>', 'insight_cron_secret');

-- 2) 호출 도우미 — job: 'collect' | 'process'
create or replace function public.insight_call(job text)
returns bigint language sql security definer set search_path = public as $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'insight_base_url') || '/api/cron/' || job,
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'insight_cron_secret'),
      'Content-Type', 'application/json'),
    body    := '{}'::jsonb,
    timeout_milliseconds := 300000
  );
$$;
revoke execute on function public.insight_call(text) from public, anon, authenticated;

-- 3) 예약 (pg_cron 시간은 UTC — 한국 시간 = UTC + 9)
--    새 글 모으기: 매일 한국 07:00
--    대기 글 처리: 15분마다 (대기 글이 없으면 바로 끝난다. 한 번에 3건 안팎씩 처리)
select cron.unschedule(jobid) from cron.job where jobname in ('insight-collect', 'insight-process');
select cron.schedule('insight-collect', '0 22 * * *',   $$ select public.insight_call('collect') $$);
select cron.schedule('insight-process', '*/15 * * * *', $$ select public.insight_call('process') $$);

-- 확인: 등록된 예약과 최근 실행 결과
--   select jobname, schedule, active from cron.job;
--   select jobid, status, return_message, start_time from cron.job_run_details order by start_time desc limit 10;
--   select id, status_code, content::text from net._http_response order by created desc limit 5;
