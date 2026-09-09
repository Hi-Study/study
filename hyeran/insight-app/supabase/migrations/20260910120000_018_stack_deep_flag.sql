-- 018: flags 에 "스택 심화" 추가
--
-- 특정 언어·프레임워크·라이브러리를 파고드는 글을 표시한다.
-- 판정 질문은 하나 — "그 기술을 안 쓰는 사람이 읽어서 가져갈 게 있는가?"
-- 단, 만드는 과정에 AI 를 쓴 이야기는 제외한다. 스택을 몰라도 읽을 값이 있다.
-- 걸러내지 않고 표시만 한다. 기준이 바뀔 수 있어 원본은 남긴다.
-- 적용: npx supabase db push

alter table public.posts drop constraint if exists posts_flags_check;
alter table public.posts add constraint posts_flags_check check (
  flags <@ array['기대와 다른 결과','직접 만들기','개발 과정에 AI','스택 심화']::text[]
);
