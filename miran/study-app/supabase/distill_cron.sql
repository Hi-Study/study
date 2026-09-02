-- ============================================================
-- distill — 수집 스케줄(pg_cron + pg_net)
-- collect 엣지 함수를 매시 정각에 호출해 신규 글을 자동 수집한다.
--
-- ⚠️ 실행 전 준비:
--   1) collect 함수 배포:  supabase functions deploy collect
--   2) 아래 {PROJECT_REF} 를 실제 값으로 치환 (현재: qripaoexmfcyrrdbcbfl)
--   3) 서비스 롤 키를 Vault 에 저장(키를 SQL 에 직접 넣지 않기 위함) — 아래 3번 블록 먼저 실행
-- ============================================================

-- 1) 확장 활성화
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2) (한 번만) 서비스 롤 키를 Vault 에 저장
--    Supabase 대시보드 > Settings > API > service_role key 를 복사해 아래 <SERVICE_ROLE_KEY> 자리에 넣고
--    이 한 줄만 먼저 실행하세요. 이미 저장돼 있으면 update 로 갱신됩니다.
--
--   select vault.create_secret('<SERVICE_ROLE_KEY>', 'distill_service_key', 'collect 호출용 서비스 롤 키');
--
--   (갱신 시)
--   select vault.update_secret(
--     (select id from vault.secrets where name='distill_service_key'),
--     '<NEW_SERVICE_ROLE_KEY>');

-- 3) 매시 정각 수집 잡 등록(블로그별 신규 최대 5건). 재실행 안전: 같은 이름이면 갱신.
select cron.unschedule('distill-collect-hourly')
where exists (select 1 from cron.job where jobname = 'distill-collect-hourly');

select cron.schedule(
  'distill-collect-hourly',
  '0 * * * *',
  $$
  select net.http_post(
    url := 'https://qripaoexmfcyrrdbcbfl.supabase.co/functions/v1/collect',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'distill_service_key')
    ),
    body := jsonb_build_object('limit', 5),
    timeout_milliseconds := 120000
  );
  $$
);

-- ============================================================
-- 4) 결정 카드 · 질문 · 난이도 · 용어 채우기(enrich) — 매시 10분.
--    수집(정각) 직후 아직 분석 안 된 글을 한 번에 5건씩 처리한다.
--    ⚠️ enrich 는 본문에 트레이드오프 서술이 없으면 decision 을 null 로 두고 질문도 안 만든다.
--       그래서 "level 이 비어 있는가"를 미처리 기준으로 쓴다(decision 은 정상적으로도 null 이 될 수 있음).
-- ============================================================
select cron.unschedule('distill-enrich-hourly')
where exists (select 1 from cron.job where jobname = 'distill-enrich-hourly');

select cron.schedule(
  'distill-enrich-hourly',
  '10 * * * *',
  $$
  select net.http_post(
    url := 'https://qripaoexmfcyrrdbcbfl.supabase.co/functions/v1/summarize',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'distill_service_key')
    ),
    body := jsonb_build_object('article_id', a.id, 'target', 'enrich'),
    timeout_milliseconds := 120000
  )
  from (
    select id from public.articles
     where level is null and body is not null
     order by published_at desc nulls last
     limit 5
  ) a;
  $$
);

-- ============================================================
-- 운영 조회(참고)
-- ============================================================
-- 등록된 잡:            select jobid, jobname, schedule, active from cron.job;
-- 최근 실행 이력:        select * from cron.job_run_details order by start_time desc limit 20;
-- 엣지 함수 HTTP 응답:   select id, status_code, content from net._http_response order by created desc limit 20;
-- 수동 1회 실행(전체):   select net.http_post(
--                          url := 'https://qripaoexmfcyrrdbcbfl.supabase.co/functions/v1/collect',
--                          headers := jsonb_build_object('Content-Type','application/json',
--                            'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='distill_service_key')),
--                          body := '{}'::jsonb, timeout_milliseconds := 150000);
-- 잡 삭제:              select cron.unschedule('distill-collect-hourly');
--                      select cron.unschedule('distill-enrich-hourly');
-- enrich 수동 1회:      select net.http_post(
--                          url := 'https://qripaoexmfcyrrdbcbfl.supabase.co/functions/v1/summarize',
--                          headers := jsonb_build_object('Content-Type','application/json',
--                            'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='distill_service_key')),
--                          body := jsonb_build_object('article_id','<ARTICLE_UUID>','target','enrich'),
--                          timeout_milliseconds := 120000);
-- 결정 카드 품질 검수:   select title, level, question, decision from public.articles
--                       where level is not null order by created_at desc limit 50;
