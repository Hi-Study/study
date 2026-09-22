-- 0017 — 기획자용 제목.
--
-- 원문 제목은 "MATCH란 무엇인가" · "AI에게 투자정보를 말하게 하기까지" 처럼 **내용을 알려주지
-- 않는 것**이 많다. 목록에서 고르는 사람은 제목만 보고 판단하므로, 기획자가 읽고 싶은 각도로
-- 다시 쓴 제목을 따로 둔다. 원문 제목(title)은 지우지 않는다 — 카드 아래 회색 한 줄로 남아
-- 출처 대조와 검색에 쓰인다.
--
-- 문장 규칙(DESIGN_GUIDE §7.2 · PRODUCT.md):
--   · **관형절 + 명사.** "지표 등록을 자동화해 실험 주기를 14배 줄인 방법"
--     끝은 방법·과정·기준·결과·이유·설계·구조·직군·이야기 중 하나.
--   · 금지: 해요체(~어요), ~했다, 화살표(→), 명사 나열, 물음표, 기업명(카드에 로고가 있다).
--   · 18~28자. 수치가 있으면 관형절 안에 넣는다("1시간을 30초로 줄인").
--   · 재료(결과·판단 근거)가 없으면 **만들지 않는다** — null 로 두고 원문 제목을 쓴다.
--     억지로 지어낸 제목이 제일 나쁘다.
--
-- 되돌리기: alter table public.articles drop column if exists planner_title;

alter table public.articles
  add column if not exists planner_title text;

comment on column public.articles.planner_title is
  '기획자용 제목 — 관형절+명사, 18~28자. 없으면 null 이고 화면은 원문 title 을 쓴다.';
