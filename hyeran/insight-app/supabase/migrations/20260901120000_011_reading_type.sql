-- 011: reading_type · tech_level 판정 컬럼  [reading_type_판별기준.md §6]
-- 카테고리(무엇에 관한 글이냐)와는 별개 축으로, "어떤 성격의 읽을거리냐"를 저장한다.
-- 적용: npx supabase db push

-- NULL 과 '{}' 는 의미가 다르다.
--   reading_type = NULL  → 아직 판정하지 않은 글 (1차는 샘플 50개만 판정하므로 대부분 NULL)
--   reading_type = '{}'  → 판정했으나 조건에 맞는 근거 문장이 없어 태그가 0개인 글 (정상 · 20~40%)
-- 그래서 기본값을 두지 않는다. 기본값 '{}' 를 주면 미판정과 태그0개가 구분되지 않는다.
alter table public.posts
  add column if not exists tech_level            smallint,                      -- 1~3 · 진입 장벽
  add column if not exists reading_type          text[],                        -- 0~4개 · 의사결정/임팩트/시행착오/구현
  add column if not exists reading_type_evidence jsonb not null default '{}'::jsonb;  -- 태그별 근거 문장 (튜닝 기간 필수)

alter table public.posts drop constraint if exists posts_tech_level_check;
alter table public.posts
  add constraint posts_tech_level_check check (tech_level is null or tech_level between 1 and 3);

-- 홈 시선 슬롯이 매 진입마다 조회하므로 인덱스를 건다 (§6)
create index if not exists posts_tech_level_idx   on public.posts (tech_level);
create index if not exists posts_reading_type_idx on public.posts using gin (reading_type);
