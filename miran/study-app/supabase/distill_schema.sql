-- ============================================================
-- distill — 스키마 (테크블로그 수집 + 인사이트 + 토론)
-- 전역 커뮤니티(스터디 멤버십 없음). 이 파일 하나로 단독 실행 가능(users 포함).
-- 재실행 안전(idempotent): 통째로 다시 Run 해도 에러 없음.
--   ※ setup_all.sql(구 스터디앱)을 이미 실행했어도 충돌 없음 — users 는 create if not exists.
--
-- 접근 모델:
--   · blogs / articles      : 로그인 사용자 읽기, 쓰기는 서버(수집)만 = service_role
--   · opinions(내 인사이트)  : 모두 읽기, 본인만 쓰기/수정/삭제
--   · opinion_comments(토론) : 모두 읽기, 본인만 쓰기/삭제
--   · article_highlights     : 모두 읽기, 본인만 쓰기/수정/삭제
--   · bookmarks / likes      : 본인 것만
-- ============================================================

-- ---------------- 0) 사용자 프로필(auth.users 와 1:1) ----------------
-- 인사이트/토론/하이라이트의 작성자(author)로 참조된다. 익명 로그인 포함 모든 가입 시
-- 트리거가 자동으로 프로필 행을 만든다(없으면 author_id FK insert 가 실패).
create table if not exists public.users (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '게스트',
  role_title text,                       -- 직급/역할 (예: PM)
  theme text not null default 'light',   -- 'light' | 'dark'
  created_at timestamptz not null default now()
);

-- auth.users insert → public.users 자동 생성
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------- 1) 블로그(수집 소스) ----------------
create table if not exists public.blogs (
  id uuid primary key default gen_random_uuid(),
  key text unique not null,                     -- 'toss','kakao',...
  name text not null,                           -- 표시명 '토스'
  homepage text,
  rss_url text,                                 -- 피드 주소(없으면 null)
  -- 수집 방식: rss_full(RSS에 본문 O) / rss_scrape(RSS 목록+페이지 본문) /
  --           nuxt(RSS 목록+Nuxt 상태 파싱) / listscrape(RSS 없음, 목록 스크랩)
  collect text not null default 'rss_full'
    check (collect in ('rss_full','rss_scrape','nuxt','listscrape')),
  brand_color text,                             -- 로고 배경색
  active boolean not null default true,
  last_collected_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------------- 2) 아티클(자동 수집 글) ----------------
create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  blog_id uuid not null references public.blogs(id) on delete cascade,
  url text unique not null,                     -- 중복 방지 키
  title text not null,
  author text,                                  -- 원문 작성자(피드 제공 시)
  published_at timestamptz,
  summary text,                                 -- 피드 요약 / og:description
  body text,                                    -- 추출한 본문 전문
  og_image text,                                -- 대표 이미지
  topic text                                    -- 고정 7주제 중 1 (분류 전 null)
    check (topic is null or topic in
      ('dev','product','design','planning','data_ai','infra','career')),
  tags text[] not null default '{}',            -- 자동 태그
  ai_summaries jsonb not null default '{}',     -- {plain,planner,explain} (온디맨드 캐시)
  created_at timestamptz not null default now()
);
create index if not exists idx_articles_blog_pub on public.articles(blog_id, published_at desc);
create index if not exists idx_articles_pub on public.articles(published_at desc);
create index if not exists idx_articles_topic on public.articles(topic);
create index if not exists idx_articles_tags on public.articles using gin(tags);

-- ---------------- 3) 의견(내 인사이트) ----------------
-- insight = { core(필수), quote, interpretation, apply, similar, questions[] }
create table if not exists public.opinions (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  insight jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_opinions_article on public.opinions(article_id, created_at desc);
create index if not exists idx_opinions_author on public.opinions(author_id, created_at desc);

-- ---------------- 4) 토론(의견에 대한 대댓글) ----------------
create table if not exists public.opinion_comments (
  id uuid primary key default gen_random_uuid(),
  opinion_id uuid not null references public.opinions(id) on delete cascade,
  parent_id uuid references public.opinion_comments(id) on delete cascade, -- null=최상위
  author_id uuid references public.users(id) on delete set null,
  text text not null,
  quote text,                                   -- 인용(대댓글)
  created_at timestamptz not null default now()
);
create index if not exists idx_ocomments_opinion on public.opinion_comments(opinion_id, created_at);
create index if not exists idx_ocomments_parent on public.opinion_comments(parent_id);

-- ---------------- 5) 문장 하이라이트(아티클 원문) ----------------
create table if not exists public.article_highlights (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  sentence_index int not null,
  quote text,
  color text not null default 'yellow',
  note text,
  created_at timestamptz not null default now(),
  unique (author_id, article_id, sentence_index)
);
create index if not exists idx_ahl_article on public.article_highlights(article_id);

-- ---------------- 6) 저장(북마크) ----------------
create table if not exists public.article_bookmarks (
  user_id uuid not null references public.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

-- ---------------- 7) 좋아요(의견/토론) ----------------
create table if not exists public.reactions (
  user_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('opinion','comment')),
  target_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);
create index if not exists idx_reactions_target on public.reactions(target_type, target_id);

-- ---------------- 8) 관심 주제(추천 피드용) ----------------
create table if not exists public.user_topics (
  user_id uuid not null references public.users(id) on delete cascade,
  topic text not null check (topic in
    ('dev','product','design','planning','data_ai','infra','career')),
  primary key (user_id, topic)
);

-- ============================================================
-- RLS
-- ============================================================
alter table public.users              enable row level security;
alter table public.blogs              enable row level security;
alter table public.articles           enable row level security;
alter table public.opinions           enable row level security;
alter table public.opinion_comments   enable row level security;
alter table public.article_highlights enable row level security;
alter table public.article_bookmarks  enable row level security;
alter table public.reactions          enable row level security;
alter table public.user_topics        enable row level security;

-- users : 프로필은 로그인 사용자 조회 허용, 수정/insert 는 본인만(insert 는 트리거가 담당).
drop policy if exists users_select on public.users;
create policy users_select on public.users for select to authenticated using (true);
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users for insert to authenticated
  with check (id = auth.uid());

-- blogs / articles : 로그인 사용자 읽기, 쓰기는 service_role(정책 없음 → RLS 우회)
drop policy if exists blogs_read on public.blogs;
create policy blogs_read on public.blogs for select to authenticated using (true);

drop policy if exists articles_read on public.articles;
create policy articles_read on public.articles for select to authenticated using (true);

-- opinions : 모두 읽기, 본인만 쓰기/수정/삭제
drop policy if exists opinions_read on public.opinions;
create policy opinions_read on public.opinions for select to authenticated using (true);
drop policy if exists opinions_insert_own on public.opinions;
create policy opinions_insert_own on public.opinions for insert to authenticated
  with check (author_id = auth.uid());
drop policy if exists opinions_update_own on public.opinions;
create policy opinions_update_own on public.opinions for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists opinions_delete_own on public.opinions;
create policy opinions_delete_own on public.opinions for delete to authenticated
  using (author_id = auth.uid());

-- opinion_comments : 모두 읽기, 본인만 쓰기/삭제
drop policy if exists ocomments_read on public.opinion_comments;
create policy ocomments_read on public.opinion_comments for select to authenticated using (true);
drop policy if exists ocomments_insert_own on public.opinion_comments;
create policy ocomments_insert_own on public.opinion_comments for insert to authenticated
  with check (author_id = auth.uid());
drop policy if exists ocomments_delete_own on public.opinion_comments;
create policy ocomments_delete_own on public.opinion_comments for delete to authenticated
  using (author_id = auth.uid());

-- article_highlights : 모두 읽기, 본인만 쓰기/수정/삭제
drop policy if exists ahl_read on public.article_highlights;
create policy ahl_read on public.article_highlights for select to authenticated using (true);
drop policy if exists ahl_insert_own on public.article_highlights;
create policy ahl_insert_own on public.article_highlights for insert to authenticated
  with check (author_id = auth.uid());
drop policy if exists ahl_update_own on public.article_highlights;
create policy ahl_update_own on public.article_highlights for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists ahl_delete_own on public.article_highlights;
create policy ahl_delete_own on public.article_highlights for delete to authenticated
  using (author_id = auth.uid());

-- bookmarks / reactions / user_topics : 본인 것만
drop policy if exists bm_all_own on public.article_bookmarks;
create policy bm_all_own on public.article_bookmarks for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists react_read on public.reactions;
create policy react_read on public.reactions for select to authenticated using (true);
drop policy if exists react_write_own on public.reactions;
create policy react_write_own on public.reactions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists utopics_all_own on public.user_topics;
create policy utopics_all_own on public.user_topics for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- 블로그 시드(18개 피드) — 재실행 시 rss/collect/색 갱신
-- ============================================================
insert into public.blogs (key, name, homepage, rss_url, collect, brand_color) values
  ('toss','토스','https://toss.tech','https://toss.tech/rss.xml','rss_full','#3182F6'),
  ('daangn','당근','https://careers.daangn.com/blog',null,'listscrape','#FF6F0F'),
  ('gangnamunni','강남언니','https://blog.gangnamunni.com','https://blog.gangnamunni.com/feed.xml','rss_scrape','#FE7BA0'),
  ('naverpay','네이버페이','https://medium.com/naverfinancial','https://medium.com/feed/naverfinancial','rss_full','#03C75A'),
  ('naver_d2','네이버 D2','https://d2.naver.com','https://d2.naver.com/d2.atom','rss_full','#1EC800'),
  ('naver_place','네이버 플레이스','https://medium.com/naver-place-dev','https://medium.com/feed/naver-place-dev','rss_full','#03C75A'),
  ('naver_dna','네이버 DNA','https://medium.com/naver-dna-tech-blog','https://medium.com/feed/naver-dna-tech-blog','rss_full','#03C75A'),
  ('kurly','컬리','https://helloworld.kurly.com','https://helloworld.kurly.com/rss.xml','rss_scrape','#5B37E5'),
  ('banksalad','뱅크샐러드','https://blog.banksalad.com','https://blog.banksalad.com/rss.xml','rss_scrape','#4E7CF6'),
  ('bucketplace','오늘의집','https://www.bucketplace.com',null,'listscrape','#35C5F0'),
  ('kakaopay','카카오페이','https://tech.kakaopay.com',null,'listscrape','#FFB61E'),
  ('kakao','카카오','https://tech.kakao.com',null,'listscrape','#111111'),
  ('coupang','쿠팡','https://medium.com/coupang-engineering','https://medium.com/feed/coupang-engineering','rss_full','#E4002B'),
  ('musinsa','무신사','https://techblog.musinsa.com','https://techblog.musinsa.com/feed','rss_full','#111111'),
  ('oliveyoung','올리브영','https://oliveyoung.tech','https://oliveyoung.tech/rss.xml','rss_full','#79B928'),
  ('aws','AWS','https://aws.amazon.com/ko/blogs/tech/','https://aws.amazon.com/ko/blogs/tech/feed/','rss_full','#FF9900'),
  ('nds','NDS Cloud','https://tech.cloud.nongshim.co.kr','https://tech.cloud.nongshim.co.kr/feed/','rss_full','#E60012'),
  ('woowahan','배달의민족','https://techblog.woowahan.com','https://techblog.woowahan.com/feed/','rss_full','#2AC1BC')
on conflict (key) do update
  set name = excluded.name, homepage = excluded.homepage, rss_url = nullif(excluded.rss_url,'null'),
      collect = excluded.collect, brand_color = excluded.brand_color;

-- listscrape 로 rss 없는 곳은 rss_url null 정리
update public.blogs set rss_url = null where rss_url = 'null';

-- ============================================================
-- 9) 글(아티클) 좋아요 — reactions 에 'article' 추가 + 인기순 정렬용 like_count
-- ============================================================
-- reactions.target_type 에 'article' 허용 (기존 제약 교체)
alter table public.reactions drop constraint if exists reactions_target_type_check;
alter table public.reactions
  add constraint reactions_target_type_check
  check (target_type in ('opinion', 'comment', 'article'));

-- 인기순 정렬용 비정규화 카운트(트리거로 유지 — RLS 로 앱은 articles 쓰기 불가하므로).
alter table public.articles add column if not exists like_count int not null default 0;
create index if not exists idx_articles_like on public.articles(like_count desc);

create or replace function public.sync_article_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.target_type = 'article') then
    update public.articles set like_count = like_count + 1 where id = new.target_id;
  elsif (tg_op = 'DELETE' and old.target_type = 'article') then
    update public.articles set like_count = greatest(0, like_count - 1) where id = old.target_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_article_like on public.reactions;
create trigger trg_article_like
  after insert or delete on public.reactions
  for each row execute function public.sync_article_like_count();

-- 기존 데이터 정합성 재계산(재실행 안전).
update public.articles a
  set like_count = (
    select count(*) from public.reactions r
    where r.target_type = 'article' and r.target_id = a.id
  );
