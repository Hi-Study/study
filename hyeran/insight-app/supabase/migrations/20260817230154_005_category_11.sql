-- 카테고리 4 → 11개 확장.
-- 순서 중요: 새 제약을 추가하기 전에 기존 값(예: '기술')을 유효한 값으로 먼저 바꿔야 한다.
-- (그러지 않으면 기존 데이터가 새 제약을 위반해 ADD CONSTRAINT 가 실패한다.)
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.

-- 1) 옛 제약 제거
alter table public.posts drop constraint if exists posts_category_check;

-- 2) 새 집합에 없는 값(예: '기술')을 임시로 '프론트엔드' 로 이동 (이후 Gemini 재분류로 정교화)
update public.posts
set category = '프론트엔드'
where category not in (
  '프로덕트','UIUX','디자인','AI','비즈니스','데이터 분석',
  '프론트엔드','백엔드','데이터베이스','보안','모바일'
);

-- 3) 11개 제약 추가 + 기본값 변경
alter table public.posts
  add constraint posts_category_check check (category in (
    '프로덕트','UIUX','디자인','AI','비즈니스','데이터 분석',
    '프론트엔드','백엔드','데이터베이스','보안','모바일'
  ));
alter table public.posts alter column category set default '프론트엔드';
