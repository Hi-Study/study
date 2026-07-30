-- ============================================================
-- 0006 · 링크 원문 본문 캐시 컬럼
-- og-preview / summarize 가 추출한 본문을 저장 → 앱에서 전문 표시 + 요약 품질 향상.
-- ============================================================
alter table public.shares add column if not exists article_text text;
