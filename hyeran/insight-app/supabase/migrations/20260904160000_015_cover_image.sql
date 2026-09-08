-- 015: 커버 이미지 컬럼 분리 (목록 성능)
--
-- 목록 화면(홈·피드·검색·기업 상세)은 카드 썸네일을 위해 posts.body 에서
-- 첫 ::img:: 한 줄만 쓴다. 그런데 body 는 글 원문 전체(평균 8.8KB)라
-- 218건 조회에 2.2MB·846ms 가 든다. 커버만 컬럼으로 빼면 276KB·117ms.
-- body 는 글 상세에서만 읽는다.
-- 적용: npx supabase db push

alter table public.posts add column if not exists cover_image text;
