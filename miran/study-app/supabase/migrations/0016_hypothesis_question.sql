-- 0016 — 인사이트 ③번 질문("왜 그 방법이면 풀린다고 봤을까요?") 저장 칸.
--
-- 인사이트 쓰기는 질문 3개에 답하는 형식이다(PRODUCT.md §4).
--   ① 우리라면 같은 선택을 할 수 있을까요   → articles.question
--   ② 우리 제품 어디에 먼저 적용해볼까요     → articles.apply_question
--   ③ 왜 그 방법이면 풀린다고 봤을까요        → articles.hypothesis_question  ← 이 마이그레이션
--
-- ③은 **원인을 묻는 칸이 아니다.** 원인은 요약(한눈에 · 더 들어가 볼까요)이 이미 말해 준다 —
-- 되물으면 답이 본문 베끼기가 된다. 물어야 할 건 원인과 해법 사이의 연결, 즉 "그 방법이면
-- 이게 해소된다"고 본 근거다. summarize 함수가 LLM 질문을 게이트(일반 게이트 + 원인 되묻기
-- 금지)에 통과시킨 것만 여기에 넣는다. 비어 있으면 앱이 결정 카드 조립 → 유형 템플릿으로
-- 내려가므로, 이 값이 null 이어도 질문 칸이 비는 일은 없다.
--
-- 되돌리기: alter table public.articles drop column if exists hypothesis_question;

alter table public.articles
  add column if not exists hypothesis_question text;

comment on column public.articles.hypothesis_question is
  '인사이트 ③번 질문 — "왜 그 방법이면 풀린다고 봤을까요?"(가설의 근거). 원인을 묻는 질문은 게이트에서 걸러진다.';
