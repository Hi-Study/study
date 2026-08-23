-- 원문 본문 스냅샷(FEATURE_ORIGINAL_SNAPSHOT 확정) — 서비스 내에서 원문을 바로 읽을 수 있게 저장한다.
-- Readability로 추출 후 sanitize-html로 정제한 HTML만 저장하며, 추출 실패 시 null로 남는다.

alter table public.articles add column body_html text;
alter table public.articles add column body_byline text;
