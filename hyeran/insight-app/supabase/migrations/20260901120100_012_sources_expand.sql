-- 012: 수집 소스 확장  [reading_type_판별기준.md §10]
-- §10 후보 9곳 중 검증(HTTP 200 · RSS/Atom 파싱 성공 · 최근 1년 내 글)을 통과한 5곳만 추가한다.
--
-- 제외한 4곳 (2026-09-01 검증 기준)
--   쿠팡              medium.com/feed/coupang-engineering  200·파싱OK 이지만 최신글 2024-10-14 (1년 이상 무업데이트)
--   직방              medium.com/feed/zigbang              200·파싱OK 이지만 최신글 2023-12-18
--   카카오엔터프라이즈 tech.kakaoenterprise.com/feed         200·파싱OK 이지만 글 2건·최신 2023-05-19
--   리디              www.ridicorp.com/feed                403 (사이트 전체가 봇 차단 · 대체 주소 없음)
--
-- 쏘카는 §10 주소가 404 였고 tech.socar.kr/rss.xml 로 대체 주소를 찾았다.
-- 적용: npx supabase db push

insert into public.companies (slug, name, color, domain, rss_url) values
  ('socar',        '쏘카',         '#00A0E9', 'tech.socar.kr',        'https://tech.socar.kr/rss.xml'),
  ('hyperconnect', '하이퍼커넥트', '#5B5FC7', 'hyperconnect.github.io','https://hyperconnect.github.io/feed.xml'),
  ('yogiyo',       '요기요',       '#FA0050', 'techblog.yogiyo.co.kr', 'https://techblog.yogiyo.co.kr/feed'),
  ('devsisters',   '데브시스터즈', '#F5A623', 'tech.devsisters.com',   'https://tech.devsisters.com/rss.xml'),
  ('nhn',          'NHN',          '#1A73E8', 'meetup.toast.com',      'https://meetup.toast.com/rss')
on conflict (slug) do nothing;
