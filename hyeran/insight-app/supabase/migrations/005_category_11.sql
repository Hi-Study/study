-- 카테고리 4 → 11개 확장. 기존 CHECK 제약 교체.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요. (미실행 시 11개 카테고리 글 저장/등록이 실패함)
alter table public.posts drop constraint if exists posts_category_check;
alter table public.posts
  add constraint posts_category_check check (category in (
    '프로덕트','UIUX','디자인','AI','비즈니스','데이터 분석',
    '프론트엔드','백엔드','데이터베이스','보안','모바일'
  ));
alter table public.posts alter column category set default '프론트엔드';
