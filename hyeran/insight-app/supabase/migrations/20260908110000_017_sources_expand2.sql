-- 017: 소스 확장 2차 — 기획·디자인 비중을 높이기 위한 6곳
--
-- 기존 17곳이 전부 개발 블로그라 problem_type 17개 중 사용자 쪽 값
-- (이탈·전환 3편, 온보딩·첫 경험, 일관성·디자인 시스템)이 거의 비어 있었다.
--
-- 검증(2026-09-08): HTTP 200 · RSS/Atom 파싱 · 최근 6개월 내 글
--   제외 — 리디(ridicorp.com 전체 403, 브라우저 헤더로도 통과 못 함)
--          오늘의집(기술블로그에 RSS 자체가 없음)
--
-- ⚠️ 요즘IT 은 기업 기술블로그가 아니라 매거진이다. 소스 유형을 나누는 대신
--    일단 companies 에 그대로 넣는다(A안). 성격이 다른 글이 실제로 도움이 되는지
--    보고 나서 kind 컬럼 분리를 결정한다.
-- 적용: npx supabase db push

insert into public.companies (slug, name, color, domain, rss_url) values
  ('oliveyoung',  'CJ올리브영',   '#A50034', 'oliveyoung.tech',        'https://oliveyoung.tech/rss.xml'),
  ('gangnamunni', '강남언니',     '#FF3A6E', 'blog.gangnamunni.com',   'https://blog.gangnamunni.com/feed.xml'),
  ('kakaostyle',  '카카오스타일', '#FA6E6E', 'devblog.kakaostyle.com', 'https://devblog.kakaostyle.com/ko/index.xml'),
  ('inflab',      '인프런',       '#00C471', 'tech.inflab.com',        'https://tech.inflab.com/rss.xml'),
  ('spoqa',       '스포카',       '#FF6B00', 'spoqa.github.io',        'https://spoqa.github.io/atom.xml'),
  ('yozm',        '요즘IT',       '#3A6EFF', 'yozm.wishket.com',       'https://yozm.wishket.com/magazine/feed/')
on conflict (slug) do nothing;
