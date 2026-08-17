-- 카테고리 4 → 11개 확장. 기존 CHECK 제약을 이름과 무관하게 모두 제거 후 새로 추가.
-- Supabase 대시보드 → SQL Editor 에 붙여넣고 실행하세요.
do $$
declare r record;
begin
  for r in
    select conname from pg_constraint
    where conrelid = 'public.posts'::regclass and contype = 'c'
  loop
    execute 'alter table public.posts drop constraint ' || quote_ident(r.conname);
  end loop;
end $$;

alter table public.posts
  add constraint posts_category_check check (category in (
    '프로덕트','UIUX','디자인','AI','비즈니스','데이터 분석',
    '프론트엔드','백엔드','데이터베이스','보안','모바일'
  ));
alter table public.posts alter column category set default '프론트엔드';
