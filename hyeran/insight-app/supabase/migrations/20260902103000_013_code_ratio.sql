-- 013: 코드 비중 컬럼  [reading_type_판별기준.md §2 대체]
--
-- §2 는 code_ratio 를 "::code:: 블록 수 / 전체 블록 수" 로 정의했지만, 코드는 여러 줄이
-- 블록 하나로 들어가고 문단은 문장 단위로 쪼개져 분모가 부풀었다. 실측 결과 193건 중
-- 0.30 을 넘는 글이 0건이라 가드레일이 발동조차 하지 않았다. 그래서 분모를 글자 수로 바꾼다.
--
-- 등급(1~3)이 아니라 비율을 그대로 저장한다. 등급을 저장하면 경계값을 바꿀 때마다
-- 전체를 다시 계산해야 하지만, 비율이면 조회 시점에 선을 그으면 된다.
-- NULL = 본문이 없거나 너무 짧아 계산 불가 (원문 파싱 실패분)
-- 적용: npx supabase db push

alter table public.posts
  add column if not exists code_ratio numeric;

alter table public.posts drop constraint if exists posts_code_ratio_check;
alter table public.posts
  add constraint posts_code_ratio_check check (code_ratio is null or (code_ratio >= 0 and code_ratio <= 1));

create index if not exists posts_code_ratio_idx on public.posts (code_ratio);
