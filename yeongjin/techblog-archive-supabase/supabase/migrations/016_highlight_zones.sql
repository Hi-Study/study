-- 하이라이트 분포(어디에 많이 표시했는지) 표시를 위한 영역 구분.

alter table public.highlights add column zone text not null default 'body'
  check (zone in ('ai_summary', 'note', 'body'));
