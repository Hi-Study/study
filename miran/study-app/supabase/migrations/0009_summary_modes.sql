-- ============================================================
-- 0009 · 글 요약 3가지 버전(모드별) 캐시
--   ai_summaries = { "plain": ..., "planner": ..., "explain": ... }
--   · plain   = 원문 요약
--   · planner = 기획자 관점(주목할 포인트/적용점)
--   · explain = 비전공자·기획자가 이해하기 쉽게 풀어쓴 버전
-- 공유 글: shares.ai_summaries (본문 요약 3버전)
-- 토론:   discussions.ai_summaries (주제+여는 글 요약 3버전)
--         discussions.ai_summary = 토론 "결과" 요약(의견+결론)으로 계속 사용
-- ============================================================
alter table public.shares      add column if not exists ai_summaries jsonb not null default '{}'::jsonb;
alter table public.discussions add column if not exists ai_summaries jsonb not null default '{}'::jsonb;
