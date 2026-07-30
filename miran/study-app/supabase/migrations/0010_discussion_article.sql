-- ============================================================
-- 0010 · 토론에도 링크 원문 본문/미리보기 캐시
-- 공유 글과 동일하게 토론 상세에서 원문 전문을 표시하기 위함.
-- og-preview 가 discussion_id 로 호출되면 이 컬럼들을 채운다.
-- ============================================================
alter table public.discussions add column if not exists og_description text;
alter table public.discussions add column if not exists article_text text;
