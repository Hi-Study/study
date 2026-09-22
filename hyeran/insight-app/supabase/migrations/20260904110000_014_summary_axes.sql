-- 014: 요약·판정 스펙 v3.2  [요약_판정_스펙.md §11]
--
-- 축 재편: category 11종→4종 / problem_type 12종 신설 / subtitle_phrase 신설.
-- ai_summary 는 jsonb 라 DDL 이 필요 없다. {problem, solution, learning} →
-- {problem, solution, impact} 로 판정 배치가 덮어쓴다.
-- 옛 learning 키는 지우지 않는다 — 배치가 중간에 실패해도 화면이 비지 않도록.
--
-- ⚠️ 011 의 reading_type / reading_type_evidence 는 이 스펙에서 폐기됐지만
--    컬럼은 남겨둔다 (삭제는 되돌릴 수 없고, 판정 50건이 들어있다).
-- 적용: npx supabase db push

-- ============================================================
-- 1) posts — 신규 컬럼
-- ============================================================
alter table public.posts
  add column if not exists problem_type    text[],  -- 1~2개, 첫 번째가 주 문제. 해당 없으면 null
  add column if not exists subtitle_phrase text;    -- 명사구만. 어미는 화면에서 붙인다 (§5)

alter table public.posts drop constraint if exists posts_problem_type_check;
alter table public.posts
  add constraint posts_problem_type_check check (
    problem_type is null or (
      array_length(problem_type, 1) between 1 and 2
      and problem_type <@ array[
        '이탈·전환','탐색·발견','온보딩·첫 경험','일관성·디자인 시스템',
        '운영·어드민','데이터 품질·계측','성능·속도','장애·안정성',
        '확장·트래픽','비용·효율','레거시 전환','개발 생산성'
      ]::text[]
    )
  );

-- ============================================================
-- 2) posts.category — 11종 → 4종
--    순서 중요: 기본값·제약을 먼저 떼고 값을 옮긴 뒤 새 제약을 건다 (005 와 같은 이유)
-- ============================================================
alter table public.posts alter column category drop default;
alter table public.posts drop constraint if exists posts_category_check;

update public.posts set category = case category
  when '프로덕트'     then '프로덕트'
  when '비즈니스'     then '프로덕트'
  when 'UIUX'        then '디자인'
  when '디자인'       then '디자인'
  when 'AI'          then '데이터/AI'
  when '데이터 분석'   then '데이터/AI'
  else '개발'          -- 프론트엔드·백엔드·데이터베이스·보안·모바일·(구)기술
end;

alter table public.posts
  add constraint posts_category_check check (category in ('프로덕트','디자인','개발','데이터/AI'));
alter table public.posts alter column category set default '개발';

-- ============================================================
-- 3) profiles — 온보딩 2단계 (§7)
-- ============================================================
alter table public.profiles
  add column if not exists role              text,    -- 기획/디자인/개발/데이터. 건너뛰면 null
  add column if not exists interest_problems text[];  -- problem_type 중 2~3개. 건너뛰면 null

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role is null or role in ('기획','디자인','개발','데이터'));

alter table public.profiles drop constraint if exists profiles_interest_problems_check;
alter table public.profiles
  add constraint profiles_interest_problems_check check (
    interest_problems is null or (
      array_length(interest_problems, 1) between 1 and 3
      and interest_problems <@ array[
        '이탈·전환','탐색·발견','온보딩·첫 경험','일관성·디자인 시스템',
        '운영·어드민','데이터 품질·계측','성능·속도','장애·안정성',
        '확장·트래픽','비용·효율','레거시 전환','개발 생산성'
      ]::text[]
    )
  );

-- ============================================================
-- 4) 인덱스 — 홈 관심 슬롯이 매 진입마다 조회한다 (§7)
-- ============================================================
create index if not exists posts_problem_type_idx on public.posts using gin (problem_type);
-- posts_tech_level_idx 는 011 에서 이미 만들었다
