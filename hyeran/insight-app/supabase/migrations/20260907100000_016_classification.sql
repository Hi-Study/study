-- 016: 분류 체계 교체  [분류체계_적용_지시서.md §1]
--
-- v3.2(category 4종 / problem_type 12종 배열 / tech_level / subtitle_phrase)를 대체한다.
-- 폐기 컬럼은 지우지 않고 "쓰지 않는 상태"로 둔다 — 새 기준이 검증되기 전에 지우면 되돌릴 수 없다.
-- 적용: npx supabase db push

-- ============================================================
-- 0) 015 미적용분 — 목록 성능 (cover_image)
--    목록 쿼리가 body(평균 8.8KB)를 통째로 끌어오던 것을 커버 URL 한 줄로 줄인다.
--    218건 기준 2,199KB·846ms → 276KB·117ms
-- ============================================================
alter table public.posts add column if not exists cover_image text;

-- ============================================================
-- 1) problem_type 재정의 — text[] 12값 → text 17값
--    타입과 값 집합이 모두 바뀌므로 옛 컬럼은 이름만 바꿔 보존한다.
-- ============================================================
alter table public.posts drop constraint if exists posts_problem_type_check;
drop index if exists posts_problem_type_idx;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'posts'
      and column_name = 'problem_type' and data_type = 'ARRAY'
  ) then
    alter table public.posts rename column problem_type to problem_type_v32;
  end if;
end $$;

alter table public.posts add column if not exists problem_type text;

-- ============================================================
-- 2) 새 분류 컬럼
-- ============================================================
alter table public.posts
  add column if not exists article_kind     text,      -- 5값. 필수
  add column if not exists impact_targets   text[] not null default '{}',
  add column if not exists result_certainty text,      -- 3값. 필수
  add column if not exists flags            text[] not null default '{}',
  add column if not exists headline         text,      -- 카드에 쓰는 우리 제목
  add column if not exists terms            jsonb  not null default '[]'::jsonb; -- [{term, description}]

alter table public.posts drop constraint if exists posts_article_kind_check;
alter table public.posts add constraint posts_article_kind_check check (
  article_kind is null or article_kind in ('개선기','소개','조직·문화','개념 설명','소식')
);

alter table public.posts drop constraint if exists posts_problem_type_check;
alter table public.posts add constraint posts_problem_type_check check (
  problem_type is null or problem_type in (
    '이탈·전환','탐색·발견','온보딩·첫 경험','일관성·디자인 시스템','성능·속도',
    '장애·안정성','보안·어뷰징','미지원 기능','운영·어드민','데이터 품질·계측',
    '확장·트래픽','비용·효율','레거시 전환','개발 생산성','사내 지식 접근',
    '판단 기준 부재','AI 출력 통제'
  )
);

alter table public.posts drop constraint if exists posts_result_certainty_check;
alter table public.posts add constraint posts_result_certainty_check check (
  result_certainty is null or result_certainty in ('수치','정성','없음')
);

alter table public.posts drop constraint if exists posts_impact_targets_check;
alter table public.posts add constraint posts_impact_targets_check check (
  impact_targets <@ array['사용자 경험','내부 생산성','자원·비용','비즈니스 성과']::text[]
);

alter table public.posts drop constraint if exists posts_flags_check;
alter table public.posts add constraint posts_flags_check check (
  flags <@ array['기대와 다른 결과','직접 만들기','개발 과정에 AI']::text[]
);

-- ============================================================
-- 3) 인덱스 — 홈 큐레이션 섹션이 매 진입마다 조회한다 (§6-1)
-- ============================================================
create index if not exists posts_article_kind_idx     on public.posts (article_kind);
create index if not exists posts_problem_type_idx     on public.posts (problem_type);
create index if not exists posts_impact_targets_idx   on public.posts using gin (impact_targets);
create index if not exists posts_flags_idx            on public.posts using gin (flags);

-- ============================================================
-- 4) 폐기 — 컬럼은 남기고 쓰지 않는다 (§1)
--    tech_level · subtitle_phrase · category · problem_type_v32
--    category 는 NOT NULL 이라 지울 수 없고, 기본값이 있어 새 글도 문제없다.
-- ============================================================
