-- AI 요약을 자유 서술(summary/key_points)에서 3항목 구조(문제/해결/디자이너·PM 관점)로 개편 (PRD v0.2 4.10)

alter table public.articles drop column if exists ai_summary;
alter table public.articles drop column if exists ai_key_points;

alter table public.articles add column ai_problem text;
alter table public.articles add column ai_solution text;
alter table public.articles add column ai_takeaway text;
