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
  -- 구글 로그인 프로필 이름을 메타데이터에서 가져옴(없으면 이메일 아이디, 그래도 없으면 '게스트').
  insert into public.users (id, name)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'name', ''),
      nullif(new.raw_user_meta_data->>'user_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '게스트'
    )
  )
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

-- ============================================================
-- 10) 내 단어장(user_words) — 본문에서 담은 어려운 단어 + AI 뜻풀이
--     · 본인만 읽기/쓰기/수정/삭제 (개인 소장 자료)
--     · definition 은 summarize 엣지함수(word_id)가 뒤이어 채운다
-- ============================================================
create table if not exists public.user_words (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  article_id  uuid references public.articles(id) on delete set null,
  term        text not null,
  reading     text,
  definition  text,
  context     text,
  created_at  timestamptz not null default now(),
  unique (user_id, term)
);
create index if not exists idx_user_words_user on public.user_words(user_id, created_at desc);

alter table public.user_words enable row level security;

drop policy if exists uwords_all_own on public.user_words;
create policy uwords_all_own on public.user_words for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- 11) 의견(opinion) 좋아요 인기순 — opinions.like_count + 트리거
--     (섹션 9의 아티클과 동일 방식. 토론 탭 인기순 정렬용.)
-- ============================================================
alter table public.opinions add column if not exists like_count int not null default 0;
create index if not exists idx_opinions_like on public.opinions(like_count desc);

create or replace function public.sync_opinion_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.target_type = 'opinion') then
    update public.opinions set like_count = like_count + 1 where id = new.target_id;
  elsif (tg_op = 'DELETE' and old.target_type = 'opinion') then
    update public.opinions set like_count = greatest(0, like_count - 1) where id = old.target_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_opinion_like on public.reactions;
create trigger trg_opinion_like
  after insert or delete on public.reactions
  for each row execute function public.sync_opinion_like_count();

-- 기존 데이터 정합성 재계산(재실행 안전).
update public.opinions o
  set like_count = (
    select count(*) from public.reactions r
    where r.target_type = 'opinion' and r.target_id = o.id
  );

-- ============================================================
-- 12) 하이라이트/메모 "나만 보기"(비공개) — 읽기도 본인 것만
--     (기존 섹션 3의 ahl_read = 모두 읽기를 본인만 읽기로 교체)
-- ============================================================
drop policy if exists ahl_read on public.article_highlights;
create policy ahl_read on public.article_highlights for select to authenticated
  using (author_id = auth.uid());

-- ============================================================
-- 13) 사용자 글 등록(URL) — 누가 등록했는지 + 시스템 '직접 등록' 블로그
--     · 삽입은 register 엣지함수(service role)가 수행하므로 articles insert 정책 불필요
--     · submitted_by 로 마이 "내가 등록한 글" 구분
-- ============================================================
alter table public.articles add column if not exists submitted_by uuid references public.users(id) on delete set null;
create index if not exists idx_articles_submitted_by on public.articles(submitted_by);

-- 도메인이 매칭되는 기존 블로그가 없을 때 귀속시킬 시스템 블로그.
insert into public.blogs (key, name, collect, active)
values ('user', '직접 등록', 'listscrape', false)
on conflict (key) do nothing;

-- ============================================================
-- 14) 기업(블로그) 즐겨찾기 — 홈 정렬 + 새 글 알림 대상
--     · 본인만 읽기/쓰기/삭제
-- ============================================================
create table if not exists public.user_blog_favorites (
  user_id    uuid not null references public.users(id) on delete cascade,
  blog_id    uuid not null references public.blogs(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, blog_id)
);

alter table public.user_blog_favorites enable row level security;

drop policy if exists ublogfav_all_own on public.user_blog_favorites;
create policy ublogfav_all_own on public.user_blog_favorites for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- 15) 알림(app_notifications) — 즐겨찾기 기업 새 글 · 내 의견 댓글 · 대댓글
--     · 본인만 읽기/수정(읽음 처리). insert 는 트리거(SECURITY DEFINER)가 수행.
-- ============================================================
create table if not exists public.app_notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,   -- 받는 사람
  kind       text not null check (kind in ('new_article','comment','reply')),
  actor_id   uuid references public.users(id) on delete set null,           -- 행위자(댓글 단 사람)
  article_id uuid references public.articles(id) on delete cascade,
  opinion_id uuid references public.opinions(id) on delete cascade,
  title      text not null default '',
  read       boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists idx_app_notif_user on public.app_notifications(user_id, created_at desc);

alter table public.app_notifications enable row level security;
drop policy if exists appnotif_select_own on public.app_notifications;
create policy appnotif_select_own on public.app_notifications for select to authenticated
  using (user_id = auth.uid());
drop policy if exists appnotif_update_own on public.app_notifications;
create policy appnotif_update_own on public.app_notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 트리거 1: 즐겨찾기한 기업에 새 글 → 즐겨찾은 사용자에게 알림(등록 본인 제외).
create or replace function public.notify_new_article()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.app_notifications (user_id, kind, article_id, title)
  select f.user_id, 'new_article', new.id, new.title
  from public.user_blog_favorites f
  where f.blog_id = new.blog_id
    and f.user_id <> coalesce(new.submitted_by, '00000000-0000-0000-0000-000000000000'::uuid);
  return null;
end; $$;
drop trigger if exists trg_notify_new_article on public.articles;
create trigger trg_notify_new_article after insert on public.articles
  for each row execute function public.notify_new_article();

-- 트리거 2: 의견 댓글 → 의견 작성자에게 / 대댓글이면 부모 댓글 작성자에게도(본인·중복 제외).
create or replace function public.notify_opinion_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  opinion_author uuid;
  parent_author uuid;
begin
  select author_id into opinion_author from public.opinions where id = new.opinion_id;
  if opinion_author is not null and opinion_author <> new.author_id then
    insert into public.app_notifications (user_id, kind, actor_id, opinion_id, title)
    values (opinion_author, 'comment', new.author_id, new.opinion_id, left(new.text, 80));
  end if;
  if new.parent_id is not null then
    select author_id into parent_author from public.opinion_comments where id = new.parent_id;
    if parent_author is not null
       and parent_author <> new.author_id
       and parent_author is distinct from opinion_author then
      insert into public.app_notifications (user_id, kind, actor_id, opinion_id, title)
      values (parent_author, 'reply', new.author_id, new.opinion_id, left(new.text, 80));
    end if;
  end if;
  return null;
end; $$;
drop trigger if exists trg_notify_opinion_comment on public.opinion_comments;
create trigger trg_notify_opinion_comment after insert on public.opinion_comments
  for each row execute function public.notify_opinion_comment();

-- ============================================================
-- 16) 읽은 아티클(article_reads) — 스크롤 90% 도달 시 '다 읽음' + 마이 읽음 모아보기
-- ============================================================
create table if not exists public.article_reads (
  user_id    uuid not null references public.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, article_id)
);
create index if not exists idx_article_reads_user on public.article_reads(user_id, created_at desc);

alter table public.article_reads enable row level security;
drop policy if exists areads_all_own on public.article_reads;
create policy areads_all_own on public.article_reads for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- 17) 의견(독후감) 임시저장(opinion_drafts) — 작성중 저장/이어쓰기(글당 1개)
-- ============================================================
create table if not exists public.opinion_drafts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  insight    jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  unique (user_id, article_id)
);
create index if not exists idx_opinion_drafts_user on public.opinion_drafts(user_id, updated_at desc);

alter table public.opinion_drafts enable row level security;
drop policy if exists odrafts_all_own on public.opinion_drafts;
create policy odrafts_all_own on public.opinion_drafts for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ============================================================
-- 18) 검색어 로깅 → 실제 급상승 검색어(최근 7일 빈도 Top N)
--     · 사용자는 본인 검색만 insert. 집계는 RPC(trending_searches)로만 노출(원자료 비공개).
-- ============================================================
create table if not exists public.search_logs (
  id         uuid primary key default gen_random_uuid(),
  term       text not null,
  user_id    uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists idx_search_logs_created on public.search_logs(created_at desc);

alter table public.search_logs enable row level security;
drop policy if exists searchlog_insert_own on public.search_logs;
create policy searchlog_insert_own on public.search_logs for insert to authenticated
  with check (user_id = auth.uid() or user_id is null);
-- select 정책 없음 → 원자료는 사용자에게 비공개(집계는 아래 RPC로만).

create or replace function public.trending_searches(lim int default 10)
returns table(term text, cnt bigint)
language sql
security definer
set search_path = public
as $$
  select lower(btrim(s.term)) as term, count(*) as cnt
  from public.search_logs s
  where s.created_at > now() - interval '7 days'
    and length(btrim(s.term)) >= 2
  group by lower(btrim(s.term))
  order by cnt desc, term asc
  limit lim;
$$;
grant execute on function public.trending_searches(int) to authenticated;

-- ============================================================
-- 19) 팔로우 — 인사이터 팔로우 + 팔로우한 사람의 새 의견(독후감) 알림
-- ============================================================
create table if not exists public.user_follows (
  follower_id  uuid not null references public.users(id) on delete cascade,
  following_id uuid not null references public.users(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);
create index if not exists idx_user_follows_following on public.user_follows(following_id);

alter table public.user_follows enable row level security;
drop policy if exists ufollows_read on public.user_follows;
create policy ufollows_read on public.user_follows for select to authenticated using (true);
drop policy if exists ufollows_write_own on public.user_follows;
create policy ufollows_write_own on public.user_follows for all to authenticated
  using (follower_id = auth.uid()) with check (follower_id = auth.uid());

-- 알림 종류에 'follow_opinion' 추가.
alter table public.app_notifications drop constraint if exists app_notifications_kind_check;
alter table public.app_notifications add constraint app_notifications_kind_check
  check (kind in ('new_article','comment','reply','follow_opinion'));

-- 팔로우한 사람이 새 의견 남기면 팔로워에게 알림.
create or replace function public.notify_new_opinion()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.author_id is not null then
    insert into public.app_notifications (user_id, kind, actor_id, opinion_id, title)
    select f.follower_id, 'follow_opinion', new.author_id, new.id,
           left(coalesce(new.insight->>'core', ''), 80)
    from public.user_follows f
    where f.following_id = new.author_id;
  end if;
  return null;
end; $$;
drop trigger if exists trg_notify_new_opinion on public.opinions;
create trigger trg_notify_new_opinion after insert on public.opinions
  for each row execute function public.notify_new_opinion();

-- ============================================================
-- 20) 커뮤니티 자유글(community_posts) — 인사이트 탭의 '커뮤니티' 서브탭.
--     · 모두 읽기, 본인만 쓰기/수정/삭제.
-- ============================================================
create table if not exists public.community_posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid references public.users(id) on delete set null,
  title      text not null,
  body       text not null,
  like_count int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists idx_community_posts_created on public.community_posts(created_at desc);

alter table public.community_posts enable row level security;
drop policy if exists cposts_read on public.community_posts;
create policy cposts_read on public.community_posts for select to authenticated using (true);
drop policy if exists cposts_insert_own on public.community_posts;
create policy cposts_insert_own on public.community_posts for insert to authenticated
  with check (author_id = auth.uid());
drop policy if exists cposts_update_own on public.community_posts;
create policy cposts_update_own on public.community_posts for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());
drop policy if exists cposts_delete_own on public.community_posts;
create policy cposts_delete_own on public.community_posts for delete to authenticated
  using (author_id = auth.uid());

-- ============================================================
-- 21) 카드 지표 — 조회수(view_count) + 인사이트 수(opinion_count)
--     · view_count: 글 열람 시 RPC(increment_article_view)로 +1 (앱은 articles 쓰기 불가 → SECURITY DEFINER)
--     · opinion_count: opinions insert/delete 트리거로 유지(섹션 9 like_count 방식)
-- ============================================================
alter table public.articles add column if not exists view_count int not null default 0;
alter table public.articles add column if not exists opinion_count int not null default 0;
create index if not exists idx_articles_view on public.articles(view_count desc);

-- 조회수 +1 (로그인 사용자 누구나 호출 가능, 서버 권한으로 articles 갱신)
create or replace function public.increment_article_view(aid uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update public.articles set view_count = view_count + 1 where id = aid;
$$;
grant execute on function public.increment_article_view(uuid) to authenticated;

-- 인사이트(opinion) 수 유지
create or replace function public.sync_article_opinion_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    update public.articles set opinion_count = opinion_count + 1 where id = new.article_id;
  elsif (tg_op = 'DELETE') then
    update public.articles set opinion_count = greatest(0, opinion_count - 1) where id = old.article_id;
  end if;
  return null;
end;
$$;
drop trigger if exists trg_article_opinion on public.opinions;
create trigger trg_article_opinion
  after insert or delete on public.opinions
  for each row execute function public.sync_article_opinion_count();

-- 기존 데이터 정합성 재계산(재실행 안전).
update public.articles a
  set opinion_count = (select count(*) from public.opinions o where o.article_id = a.id);

-- ============================================================
-- 22) 커뮤니티 자유글에 감상문(insight) 항목 — 인사이트와 동일 구조로 작성.
--     ※ 현재 자유글은 "제목 + 내용"만 쓴다. 이 컬럼은 예전에 감상문 폼으로 쓴 글을 보여주기 위한 레거시.
-- ============================================================
alter table public.community_posts add column if not exists insight jsonb not null default '{}';

-- ============================================================
-- 23) 커뮤니티 자유글 — 좋아요 + 댓글/대댓글
--     · 좋아요: reactions.target_type 에 'community' 추가 + like_count 동기화 트리거(섹션 9/11과 동일 방식)
--     · 댓글  : 새 테이블을 만들지 않고 opinion_comments 를 **범용 댓글 테이블**로 확장
--               (opinion_id | community_post_id 중 정확히 하나만 채운다)
--               → 스레드/대댓글/좋아요/수정·삭제 로직을 인사이트와 그대로 공유한다.
-- ============================================================

-- 23-1) 자유글 좋아요
alter table public.reactions drop constraint if exists reactions_target_type_check;
alter table public.reactions
  add constraint reactions_target_type_check
  check (target_type in ('opinion', 'comment', 'article', 'community'));

create or replace function public.sync_community_like_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.target_type = 'community') then
    update public.community_posts set like_count = like_count + 1 where id = new.target_id;
  elsif (tg_op = 'DELETE' and old.target_type = 'community') then
    update public.community_posts set like_count = greatest(0, like_count - 1) where id = old.target_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_community_like on public.reactions;
create trigger trg_community_like
  after insert or delete on public.reactions
  for each row execute function public.sync_community_like_count();

-- 기존 데이터 정합성 재계산(재실행 안전).
update public.community_posts p
  set like_count = (
    select count(*) from public.reactions r
    where r.target_type = 'community' and r.target_id = p.id
  );

-- 23-2) 댓글 테이블 범용화 — 자유글에도 댓글/대댓글
alter table public.opinion_comments
  add column if not exists community_post_id uuid references public.community_posts(id) on delete cascade;
alter table public.opinion_comments alter column opinion_id drop not null;

-- 둘 중 정확히 하나만 채워져야 한다(글 종류 판별 = 이 컬럼).
alter table public.opinion_comments drop constraint if exists opinion_comments_target_check;
alter table public.opinion_comments
  add constraint opinion_comments_target_check
  check (num_nonnulls(opinion_id, community_post_id) = 1);

create index if not exists idx_ocomments_community
  on public.opinion_comments(community_post_id, created_at);

-- 23-3) 자유글 댓글 수(comment_count) — 홈 "이야기 나누고 있어요" 정렬/카드 지표용.
--       (목록에서 글마다 댓글을 세는 쿼리를 날리지 않도록 비정규화 + 트리거로 유지)
alter table public.community_posts add column if not exists comment_count int not null default 0;
create index if not exists idx_community_posts_active
  on public.community_posts(comment_count desc, like_count desc);

create or replace function public.sync_community_comment_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT' and new.community_post_id is not null) then
    update public.community_posts set comment_count = comment_count + 1 where id = new.community_post_id;
  elsif (tg_op = 'DELETE' and old.community_post_id is not null) then
    update public.community_posts set comment_count = greatest(0, comment_count - 1) where id = old.community_post_id;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_community_comment on public.opinion_comments;
create trigger trg_community_comment
  after insert or delete on public.opinion_comments
  for each row execute function public.sync_community_comment_count();

-- 기존 데이터 정합성 재계산(재실행 안전).
update public.community_posts p
  set comment_count = (
    select count(*) from public.opinion_comments oc where oc.community_post_id = p.id
  );

-- 알림 트리거는 "의견 댓글"만 대상 — 자유글 댓글은 건너뛴다(app_notifications 가 opinion_id 기준이라).
create or replace function public.notify_opinion_comment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  opinion_author uuid;
  parent_author uuid;
begin
  if new.opinion_id is null then
    return null;                                  -- 자유글 댓글: 알림 대상 아님
  end if;
  select author_id into opinion_author from public.opinions where id = new.opinion_id;
  if opinion_author is not null and opinion_author <> new.author_id then
    insert into public.app_notifications (user_id, kind, actor_id, opinion_id, title)
    values (opinion_author, 'comment', new.author_id, new.opinion_id, left(new.text, 80));
  end if;
  if new.parent_id is not null then
    select author_id into parent_author from public.opinion_comments where id = new.parent_id;
    if parent_author is not null
       and parent_author <> new.author_id
       and parent_author is distinct from opinion_author then
      insert into public.app_notifications (user_id, kind, actor_id, opinion_id, title)
      values (parent_author, 'reply', new.author_id, new.opinion_id, left(new.text, 80));
    end if;
  end if;
  return null;
end; $$;

-- ============================================================
-- 24) 온보딩 · 직무(job_role) — 구글 로그인 직후 1화면에서 받는다.
--     직무 하나로 ①역할별 AI 요약 ②직군 배지("기획자 12명이 읽었어요")
--     ③단어장 개인화가 전부 돌아간다.
--     · users.job_role      : 'planner' | 'designer' | 'marketer' | 'dev' | 'data' | 'other'
--     · users.onboarded_at  : 온보딩 완료 시각(있으면 온보딩 화면을 다시 띄우지 않는다)
-- ============================================================
alter table public.users add column if not exists job_role text
  check (job_role is null or job_role in ('planner','designer','marketer','dev','data','other'));
alter table public.users add column if not exists onboarded_at timestamptz;

-- 관심 주제에 'marketing' 추가(기존 7주제 + 1). articles.topic 도 동일하게 확장.
alter table public.user_topics drop constraint if exists user_topics_topic_check;
alter table public.user_topics
  add constraint user_topics_topic_check
  check (topic in ('dev','product','design','planning','data_ai','infra','career','marketing'));

alter table public.articles drop constraint if exists articles_topic_check;
alter table public.articles
  add constraint articles_topic_check
  check (topic is null or topic in
    ('dev','product','design','planning','data_ai','infra','career','marketing'));

-- ============================================================
-- 25) 수집 소스 확장 — blogs.kind 로 "개발 글" 밖의 소스를 구분한다.
--     tech(기술) · design(디자인) · product(프로덕트/기획) · culture(문화·브랜드)
--     기존 18개는 전부 tech 로 두고, B컷(배민)을 culture 로 추가한다.
-- ============================================================
alter table public.blogs add column if not exists kind text not null default 'tech'
  check (kind in ('tech','design','product','culture'));

-- B컷 by 배민 — WordPress 라 /feed/ 에서 content:encoded(전문)를 준다 → rss_full.
--   카테고리: Product&Tech / Culture / Impact. 개발 글이 아닌 '판단·문화' 소스라 kind='culture'.
insert into public.blogs (key, name, homepage, rss_url, collect, brand_color, kind) values
  ('bcut','B컷 by 배민','https://bcut.baemin.com','https://bcut.baemin.com/feed/','rss_full','#2AC1BC','culture')
on conflict (key) do update
  set name = excluded.name, homepage = excluded.homepage, collect = excluded.collect,
      brand_color = excluded.brand_color, kind = excluded.kind;

create index if not exists idx_blogs_kind on public.blogs(kind) where active;

-- ============================================================
-- 26) 아티클 메타 — 난이도 배지 · 읽는 시간 · 결정 카드 · 질문 · 용어
--     전부 수집 시 AI 배치가 채우고, 못 채우면 null 로 두고 화면에서 숨긴다(폴백 안전).
--     · level        : 'easy'(술술 읽혀요) | 'terms'(용어 몇 개만) | 'code'(코드까지 들어가요)
--     · read_minutes : 예상 읽기 분
--     · decision     : {problem, constraint, chosen, rejected, metric} — 결정 카드
--     · question     : 인사이트 유도 질문 1개.
--                      **decision.chosen / decision.rejected 가 둘 다 있을 때만 생성**한다.
--                      억지로 만들지 않는다(없으면 화면은 스탬프만 보여준다).
--     · terms        : [{term, plain, why, domain}] — 본문 용어 풀이(단어장 연결)
-- ============================================================
alter table public.articles add column if not exists level text
  check (level is null or level in ('easy','terms','code'));
alter table public.articles add column if not exists read_minutes int;
alter table public.articles add column if not exists decision jsonb;
alter table public.articles add column if not exists question text;
alter table public.articles add column if not exists terms jsonb not null default '[]';

create index if not exists idx_articles_level on public.articles(level);

-- ============================================================
-- 27) 원탭 스탬프 — 글을 다 읽고 버튼 하나만 누르는 반응.
--     인사이트를 못 쓰는 다수에게서 큐레이션 데이터를 얻는 통로.
--     kind: apply(우리도 써먹겠다) · reason(결정 근거가 인상적)
--           disagree(반대 의견 있음) · hard(용어가 어려웠다)
--     한 사람이 한 글에 여러 종류를 누를 수 있다(같은 종류 중복만 막는다).
-- ============================================================
create table if not exists public.article_stamps (
  user_id    uuid not null references public.users(id) on delete cascade,
  article_id uuid not null references public.articles(id) on delete cascade,
  kind       text not null check (kind in ('apply','reason','disagree','hard')),
  created_at timestamptz not null default now(),
  primary key (user_id, article_id, kind)
);
create index if not exists idx_article_stamps_article on public.article_stamps(article_id, kind);
create index if not exists idx_article_stamps_user on public.article_stamps(user_id, created_at desc);

alter table public.article_stamps enable row level security;

-- 남의 스탬프도 집계로 보여줘야 하므로 읽기는 전체 허용, 쓰기는 본인 것만.
drop policy if exists stamps_read_all on public.article_stamps;
create policy stamps_read_all on public.article_stamps for select to authenticated using (true);
drop policy if exists stamps_write_own on public.article_stamps;
create policy stamps_write_own on public.article_stamps for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 글별 스탬프 집계(카드/상세에서 "💡 12" 처럼 표시).
create or replace function public.article_stamp_counts(p_article_ids uuid[])
returns table (article_id uuid, kind text, cnt bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select s.article_id, s.kind, count(*)::bigint
  from public.article_stamps s
  where s.article_id = any(p_article_ids)
  group by s.article_id, s.kind;
$fn$;

-- ============================================================
-- 28) 단어장 개인화 — 단어를 누른 것 자체가 "이 영역에 약하다"는 신호.
--     비개발자 전용 기능이 아니다: 개발자가 '리텐션/코호트/LTV' 를 누르면 대칭으로 작동한다.
--     · domain          : 단어가 속한 영역(dev/design/marketing/data/infra/product/biz)
--     · easy_definition : "더 쉽게" 2단 설명(직무 언어 + 비유). 처음엔 비고 요청 시 채운다
--     · job_role        : 누를 당시 그 사람의 직무(뜻풀이를 다시 쓸 때 재료)
--     · hit_count       : 같은 단어를 다시 누른 횟수
-- ============================================================
alter table public.user_words add column if not exists domain text;
alter table public.user_words add column if not exists easy_definition text;
alter table public.user_words add column if not exists job_role text;
alter table public.user_words add column if not exists hit_count int not null default 1;

create index if not exists idx_user_words_domain on public.user_words(user_id, domain);

-- 내가 자주 막히는 영역 = 도메인별 단어 클릭 수. 마이 화면 "자주 막히는 영역".
create or replace function public.my_weak_domains(p_user_id uuid)
returns table (domain text, cnt bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select w.domain, sum(w.hit_count)::bigint as cnt
  from public.user_words w
  where w.user_id = p_user_id and w.domain is not null
  group by w.domain
  order by sum(w.hit_count) desc;
$fn$;

-- ============================================================
-- 29) 읽기 기록 통계 — 연속 읽기 배지(벌칙 없음) + 이번 달 누적.
--     연속이 끊겨도 0 을 보여주지 않는다(화면에서 불꽃만 숨긴다).
--     ※ article_reads 는 (user_id, article_id) PK 라 같은 글 재독은 날짜가 안 바뀐다.
--        연속은 '읽은 글이 하나라도 있는 날' 기준이므로 이걸로 충분하다.
-- ============================================================
create or replace function public.my_reading_stats(p_user_id uuid)
returns table (streak_days int, month_days int, month_reads int, month_opinions int)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  v_streak int := 0;
  v_day date;
  v_next date;
begin
  -- 연속: 오늘(또는 어제)부터 하루씩 거슬러 올라가며 읽은 날이 이어지는 만큼 센다.
  -- 오늘 아직 안 읽었어도 어제까지 이어졌으면 유지한다(하루가 끝나기 전에 깎지 않음).
  select max(d) into v_day
  from (select distinct (created_at at time zone 'Asia/Seoul')::date as d
          from public.article_reads where user_id = p_user_id) t
  where d >= (now() at time zone 'Asia/Seoul')::date - 1;

  while v_day is not null loop
    v_streak := v_streak + 1;
    select d into v_next
    from (select distinct (created_at at time zone 'Asia/Seoul')::date as d
            from public.article_reads where user_id = p_user_id) t
    where d = v_day - 1;
    v_day := v_next;
    v_next := null;
  end loop;

  return query
  select
    v_streak,
    (select count(distinct (created_at at time zone 'Asia/Seoul')::date)::int
       from public.article_reads
      where user_id = p_user_id
        and (created_at at time zone 'Asia/Seoul')::date
            >= date_trunc('month', (now() at time zone 'Asia/Seoul')::date)),
    (select count(*)::int from public.article_reads
      where user_id = p_user_id
        and (created_at at time zone 'Asia/Seoul')::date
            >= date_trunc('month', (now() at time zone 'Asia/Seoul')::date)),
    (select count(*)::int from public.opinions
      where author_id = p_user_id
        and (created_at at time zone 'Asia/Seoul')::date
            >= date_trunc('month', (now() at time zone 'Asia/Seoul')::date));
end;
$fn$;

-- ============================================================
-- 30) 직군 배지 — "기획자 12명이 이 글을 읽었어요".
--     들어와서 개발자만 보이면 비개발자는 바로 나간다. 같은 직군의 존재를 보여준다.
-- ============================================================
create or replace function public.article_reader_roles(p_article_id uuid)
returns table (job_role text, cnt bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select u.job_role, count(*)::bigint as cnt
  from public.article_reads r
  join public.users u on u.id = r.user_id
  where r.article_id = p_article_id and u.job_role is not null
  group by u.job_role
  order by count(*) desc;
$fn$;

-- ============================================================
-- 31) 직군 배지를 **목록에서도** 보여주기 위한 일괄 조회.
--     상세에서만 "기획자 3명이 읽고 있어요"가 보이면, 정작 들어갈 글을 고르는
--     목록에서는 그 신호를 못 쓴다. 비개발자가 남을지 말지는 목록에서 갈린다.
--
--     ⚠️ 글마다 RPC 를 부르면 화면 하나에 수십 번 왕복한다. 그래서 **한 번에**
--        전부 받아 캐시한다. 읽힌 글만 나오므로 결과가 작다(실측 21건).
--        글당 1등 직군 하나만 — 목록 카드에 배지를 두 개 붙일 자리는 없다.
-- ============================================================
create or replace function public.all_top_reader_roles()
returns table (article_id uuid, job_role text, cnt bigint)
language sql
stable
security definer
set search_path = public
as $fn$
  select distinct on (r.article_id)
         r.article_id, u.job_role, count(*) over (partition by r.article_id, u.job_role)::bigint as cnt
  from public.article_reads r
  join public.users u on u.id = r.user_id
  where u.job_role is not null
  order by r.article_id, count(*) over (partition by r.article_id, u.job_role) desc, u.job_role;
$fn$;

grant execute on function public.all_top_reader_roles() to anon, authenticated;
