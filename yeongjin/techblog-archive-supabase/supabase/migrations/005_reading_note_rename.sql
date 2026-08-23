-- 2026-08-06 회의 반영: "등록자 노트"(핵심 인사이트/정리할 기술 지식/바로 적용할 점)를
-- "독후감"(인상 깊은 부분/접목하고 싶은 방법/질문·토론하고 싶은 것)으로 개편

alter table public.articles rename column core_insight to impressive_part;
alter table public.articles rename column tech_knowledge to apply_idea;
alter table public.articles rename column action_point to discussion_question;
