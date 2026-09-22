-- ============================================================
-- 0015 · 기획자용 대분류(기준 v1) + 검색 태그
-- ------------------------------------------------------------
-- 기존 articles.topic(고정 7주제 키워드 분류)과 articles.tags(키워드 태그)는
-- **건드리지 않는다.** 화면이 아직 그 값을 쓰고 있어서, 덮어쓰면 피드가 비어 버린다.
-- 새 분류는 별도 컬럼으로 쌓고, 화면 전환이 끝난 뒤에 옛 컬럼을 정리한다.
--
-- · planner_included  : 서비스에 노출할 글인지(기준 v1 1단계 포함/제외)
-- · planner_category  : 대분류 7개 중 1 (제외 글은 null)
-- · planner_tags      : {"purpose":"효율화","methods":[...],"contexts":[...],"tech":[...]}
-- · planner_summary   : 판정한 글의 결론 한 줄
-- · planner_evidence  : 그 판정의 근거가 된 본문 문장(원문 그대로)
-- · planner_votes     : 3회 판정 집계 결과(예: "AI 활용 3") — 재분류 없이 신뢰도를 남긴다
-- · planner_version   : 적용한 기준 버전. 기준이 바뀌어도 이미 확정된 글은 다시 돌리지 않는다
-- · planner_at        : 분류 확정 시각
-- ============================================================

alter table public.articles add column if not exists planner_included boolean;
alter table public.articles add column if not exists planner_category text;
alter table public.articles add column if not exists planner_tags jsonb not null default '{}';
alter table public.articles add column if not exists planner_summary text;
alter table public.articles add column if not exists planner_evidence text;
alter table public.articles add column if not exists planner_votes text;
alter table public.articles add column if not exists planner_version text;
alter table public.articles add column if not exists planner_at timestamptz;

-- 대분류는 기준 v1의 7개 이름만 허용한다(오타·옛 이름이 섞이면 필터가 조용히 빈다).
alter table public.articles drop constraint if exists articles_planner_category_check;
alter table public.articles
  add constraint articles_planner_category_check
  check (planner_category is null or planner_category in (
    'AI 활용',
    '제품·서비스 기획',
    '데이터·실험',
    '사용자 이해·경험',
    '사업·브랜드',
    '협업·프로세스',
    '품질·위험 관리'
  ));

-- 제외 글에는 대분류가 없고, 포함 글에는 반드시 있다.
alter table public.articles drop constraint if exists articles_planner_pair_check;
alter table public.articles
  add constraint articles_planner_pair_check
  check (
    planner_included is null                                   -- 아직 분류 안 한 글
    or (planner_included = true  and planner_category is not null)
    or (planner_included = false and planner_category is null)
  );

-- 피드: 대분류별 최신순. 제외 글과 미분류 글은 인덱스에서 뺀다.
create index if not exists idx_articles_planner_cat
  on public.articles(planner_category, published_at desc)
  where planner_included;

-- 태그 필터(목적/방법/제품·상황/기술 모두 jsonb 안에 있다).
create index if not exists idx_articles_planner_tags
  on public.articles using gin(planner_tags);
