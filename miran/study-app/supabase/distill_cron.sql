-- ============================================================
-- distill — 자동 파이프라인(pg_cron + pg_net)
--
--   :00  수집   collect   블로그 RSS → 원문 본문까지 저장
--   :15  요약   guide     한눈에(무슨 일/왜/그래서) + 소제목 + 용어
--   :30  분류   classify  대분류 1개 + 대표 태그(목적) + 세부 태그
--   :45  보강   enrich    난이도 배지 · 생각해볼 질문
--
-- **새 글은 이 네 단계를 한 시간 안에 다 거친다.** 사람이 글을 열어야 요약이 생기던
-- 예전 방식은 버렸다 — 아무도 안 연 글은 영원히 요약이 없었다(779건 중 9건).
--
-- ⚠️ 한도: Groq 무료 티어 = 분당 8,000토큰(TPM) · **하루 200,000토큰(TPD)**.
--    한 건 값: guide **7,000**(LLM 2회 — 뼈대 + 원문 전문 읽고 다시 쓰기) ·
--              classify 3,000(판정 2~3회) · enrich 3,000.
--
--    **이 잡들은 "일감이 있을 때만" 돈다.** 후보가 0건이면 net.http_post 가 아예 실행되지
--    않아 토큰이 0이다. 그래서 평소 소비는 신규 글 수에 비례한다 —
--    하루 5건이면 5×(7,000+3,000+3,000) = 65,000 으로 한도의 1/3이다.
--
--    ⚠️ 다만 **범위 안에 밀린 글이 쌓이면 매시 돌아 한도를 넘길 수 있다**
--       (최악: 7,000×24 + 3,000×24 + 3,000×24 = 312,000).
--       그래서 각 잡은 **최근 30일 글만** 본다 — 창을 넓히려면 이 계산을 다시 해야 한다.
--    **밀린 예전 글은 크론이 아니라 손으로 채운다**: npm run guide / npm run classify
--
-- ⚠️ 실행 전 준비:
--   1) 함수 배포:  supabase functions deploy collect / summarize
--   2) 스키마의 §38(guide_tried_at · classify_tried_at) 먼저 실행
--   3) 서비스 롤 키를 Vault 에 저장 — 아래 2번 블록
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
-- 4) 난이도 배지 · 생각해볼 질문 채우기(enrich) — 매시 45분.
--
-- ⚠️ "level 이 비어 있는가"를 미처리 기준으로 쓴다.
--    enrich 는 본문에 트레이드오프 서술이 없으면 decision 을 null 로 두고 질문도 안 만든다 —
--    decision 은 정상적으로도 null 이 될 수 있어서 기준으로 못 쓴다.
-- ============================================================
select cron.unschedule('distill-enrich-hourly')
where exists (select 1 from cron.job where jobname = 'distill-enrich-hourly');

select cron.schedule(
  'distill-enrich-hourly',
  '45 * * * *',
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
     where level is null
       and body is not null
       -- 날짜를 못 읽은 글(수집 실패로 published_at 이 빈 13건)도 집는다.
       -- 빼 두면 그 글들은 영영 자동 처리에서 빠진다.
       and (published_at > now() - interval '30 days' or published_at is null)
     order by published_at desc nulls last
     limit 1
  ) a;
  $$
);

-- ============================================================
-- 5) 읽기 가이드(요약) 자동 생성 — 매시 15분.
--
-- 미처리 기준은 "reading_guide 가 비었나"가 아니라 **"lead 가 있나"**다.
-- 옛 형식(v1 steps · v2 points)은 값이 있어도 앱이 못 읽어 다시 만들어야 한다.
--
-- ⚠️ 고른 글에 **먼저 시도 시각을 찍고** 부른다(§38).
--    안 그러면 게이트를 영영 통과 못 하는 글 하나가 매시 다시 뽑혀
--    하루 치 토큰을 통째로 태운다. 안 해본 글 → 오래전에 해본 글 순으로 돈다.
-- ============================================================
select cron.unschedule('distill-guide-hourly')
where exists (select 1 from cron.job where jobname = 'distill-guide-hourly');
select cron.unschedule('distill-guide-2h')
where exists (select 1 from cron.job where jobname = 'distill-guide-2h');

select cron.schedule(
  'distill-guide-hourly',
  '15 * * * *',
  $$
  with pick as (
    select id from public.articles
     where body is not null
       and length(body) >= 400
       and reading_guide -> 'lead' is null
       -- 날짜를 못 읽은 글(수집 실패로 published_at 이 빈 13건)도 집는다.
       -- 빼 두면 그 글들은 영영 자동 처리에서 빠진다.
       and (published_at > now() - interval '30 days' or published_at is null)
     order by guide_tried_at nulls first, published_at desc nulls last
     limit 1
  ), stamped as (
    update public.articles set guide_tried_at = now()
     where id in (select id from pick)
    returning id
  )
  select net.http_post(
    url := 'https://qripaoexmfcyrrdbcbfl.supabase.co/functions/v1/summarize',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'distill_service_key')
    ),
    body := jsonb_build_object('article_id', stamped.id, 'target', 'guide'),
    timeout_milliseconds := 120000
  )
  from stamped;
  $$
);

-- ============================================================
-- 6) 대분류·태그 자동 판정(classify) — 매시 30분.
--
-- 판정이 흔들리면(3번 물어 2번 이상 같은 답이 안 나오면) topic 을 비워 둔다.
-- 그래서 같은 글이 다시 걸릴 수 있는데, 그게 맞다 — 억지로 채우면 필터 전체를 못 믿게 된다.
-- 대신 §38 의 시도 시각 덕에 **다른 글을 한 바퀴 돈 뒤에** 다시 온다.
-- ============================================================
select cron.unschedule('distill-classify-hourly')
where exists (select 1 from cron.job where jobname = 'distill-classify-hourly');
select cron.unschedule('distill-classify-2h')
where exists (select 1 from cron.job where jobname = 'distill-classify-2h');

select cron.schedule(
  'distill-classify-hourly',
  '30 * * * *',
  $$
  with pick as (
    select id from public.articles
     where topic is null
       and body is not null
       -- 날짜를 못 읽은 글(수집 실패로 published_at 이 빈 13건)도 집는다.
       -- 빼 두면 그 글들은 영영 자동 처리에서 빠진다.
       and (published_at > now() - interval '30 days' or published_at is null)
     order by classify_tried_at nulls first, published_at desc nulls last
     limit 1
  ), stamped as (
    update public.articles set classify_tried_at = now()
     where id in (select id from pick)
    returning id
  )
  select net.http_post(
    url := 'https://qripaoexmfcyrrdbcbfl.supabase.co/functions/v1/summarize',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' ||
        (select decrypted_secret from vault.decrypted_secrets where name = 'distill_service_key')
    ),
    body := jsonb_build_object('article_id', stamped.id, 'target', 'classify'),
    timeout_milliseconds := 120000
  )
  from stamped;
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
--                      select cron.unschedule('distill-guide-hourly');
--                      select cron.unschedule('distill-classify-hourly');
-- 남은 일감(최근 30일 = 크론이 보는 범위):
--   select count(*) filter (where reading_guide -> 'lead' is null) as 요약_남음,
--          count(*) filter (where topic is null)                  as 분류_남음,
--          count(*) filter (where level is null)                  as 보강_남음
--     from public.articles
--    where body is not null and published_at > now() - interval '30 days';
-- 전체 밀린 양(손으로 채울 몫 — npm run guide / npm run classify):
--   select count(*) filter (where reading_guide -> 'lead' is null) as 요약_남음,
--          count(*) filter (where topic is null)                  as 분류_남음
--     from public.articles where body is not null;
-- enrich 수동 1회:      select net.http_post(
--                          url := 'https://qripaoexmfcyrrdbcbfl.supabase.co/functions/v1/summarize',
--                          headers := jsonb_build_object('Content-Type','application/json',
--                            'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name='distill_service_key')),
--                          body := jsonb_build_object('article_id','<ARTICLE_UUID>','target','enrich'),
--                          timeout_milliseconds := 120000);
-- 결정 카드 품질 검수:   select title, level, question, decision from public.articles
--                       where level is not null order by created_at desc limit 50;
