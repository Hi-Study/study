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
--
-- ⚠️ 값 목록에 **기준 v1 의 새 7값도 함께** 넣어 둔다(§36 에서 이 값들로 이관한다).
--    여기서 옛 값만 허용하면, 이미 이관을 끝낸 DB 에 이 파일을 다시 돌릴 때
--    `articles_topic_check is violated by some row` 로 터진다 — 실제로 그렇게 겪었다.
--    이 파일은 **처음부터 끝까지 다시 돌려도 되어야** 한다. 제약을 좁히는 건 §36-5 한 곳뿐이다.
alter table public.user_topics drop constraint if exists user_topics_topic_check;
alter table public.user_topics
  add constraint user_topics_topic_check
  check (topic in (
    'dev','product','design','planning','data_ai','infra','career','marketing',
    'ai_use','product_plan','data_exp','user_exp','biz_brand','collab','quality_risk'
  ));

alter table public.articles drop constraint if exists articles_topic_check;
alter table public.articles
  add constraint articles_topic_check
  check (topic is null or topic in (
    'dev','product','design','planning','data_ai','infra','career','marketing',
    'ai_use','product_plan','data_exp','user_exp','biz_brand','collab','quality_risk'
  ));

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

-- ============================================================
-- 32) 감상문 질문 2개 — 인사이트용(articles.question) + 접목용(apply_question).
--     하나는 "이 글에서 무엇을 봤나", 하나는 "그래서 우리는 무엇을 하나".
--     읽고 끝나면 남는 게 없으므로 두 번째가 이 서비스의 값어치다.
-- ============================================================
alter table public.articles add column if not exists apply_question text;

-- ============================================================================
-- 33) 읽기 가이드 — 테크 블로그를 비개발자가 따라 읽을 수 있게 만드는 층
-- ----------------------------------------------------------------------------
-- 원문 순서는 **바꾸지 않는다.** 원문 소제목 단위로 덩어리를 나누고, 덩어리마다
-- ① 쉬운 제목 ② 여기서 하는 말 한 줄 ③ 중요도(핵심/참고/개발자용)를 얹는다.
--
-- 왜 재배치가 아니라 덧붙이기인가:
--   · 글쓴이가 A→B→C 로 쓴 데는 이유가 있다(앞을 알아야 뒤가 이해된다). 흩으면 더 안 읽힌다.
--   · 덧붙이기는 AI 가 틀려도 원문이 그대로다. 재배치는 틀리면 글이 뒤죽박죽이 된다.
--   · 결정 카드(§26 decision)를 화면에서 뺀 이유와 같다 — 데이터가 비면 껍데기가 되는 구조는 쓰지 않는다.
--
-- reading_guide jsonb 모양:
--   {
--     "intro": "이 글은 …(2~3문장)",
--     "terms": [{"term":"파티셔닝","plain":"큰 데이터를 기간별로 나눠 보관하는 것"}],
--     "steps": [{"start":0,"title":"어쩌다 느려졌나","say":"…","weight":"core|ref|dev"}],
--     "takeaways": ["…","…"]
--   }
--   steps[i].start = **블록(문단) 번호**. 끝 번호는 저장하지 않는다 —
--   다음 단계의 start-1 이 곧 끝이라, 구간이 겹치거나 비는 일이 구조적으로 불가능하다.
--   (마지막 단계는 본문 끝까지.) 블록 번호는 앱의 groupSentencesIntoBlocks 순번과 같다.
alter table public.articles add column if not exists reading_guide jsonb;

-- ============================================================================
-- 34) 아카이브 — 사용자가 직접 만드는 보관함(이름 + 아이콘)
-- ----------------------------------------------------------------------------
-- 북마크(§6 article_bookmarks)는 그대로 둔다. 북마크 = "저장", 아카이브 = "분류".
-- 둘을 합치면 저장이 무거워진다(담을 때마다 폴더를 골라야 한다).
-- 아카이브에 담긴 글은 북마크에도 자동으로 들어간다(앱에서 처리) — 저장 안 한 글이
-- 보관함에만 있으면 "내 북마크"와 숫자가 어긋나 보인다.
create table if not exists public.archives (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.users(id) on delete cascade,
  name        text not null check (char_length(trim(name)) between 1 and 15),
  icon        text not null default 'all',
  sort        int  not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists archives_user_idx on public.archives (user_id, sort, created_at);

create table if not exists public.archive_articles (
  archive_id  uuid not null references public.archives(id) on delete cascade,
  article_id  uuid not null references public.articles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (archive_id, article_id)
);
create index if not exists archive_articles_article_idx on public.archive_articles (article_id);

alter table public.archives          enable row level security;
alter table public.archive_articles  enable row level security;

drop policy if exists archives_all_own on public.archives;
create policy archives_all_own on public.archives
  for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 담긴 글 행은 **부모 아카이브의 주인**만 만질 수 있다(행 자체에는 user_id 가 없다).
drop policy if exists archive_articles_all_own on public.archive_articles;
create policy archive_articles_all_own on public.archive_articles
  for all to authenticated
  using (exists (select 1 from public.archives a where a.id = archive_id and a.user_id = auth.uid()))
  with check (exists (select 1 from public.archives a where a.id = archive_id and a.user_id = auth.uid()));

-- 아카이브별 글 개수 — 그리드 타일의 "N개". 목록을 다 받아와 세면 카드 수만큼 쿼리가 늘어난다.
create or replace function public.my_archive_counts(p_user_id uuid)
returns table (archive_id uuid, cnt bigint)
language sql stable security definer set search_path = public as $$
  select aa.archive_id, count(*)::bigint
  from public.archive_articles aa
  join public.archives a on a.id = aa.archive_id
  where a.user_id = p_user_id
  group by aa.archive_id;
$$;

-- 완독률 — 홈 상단 "영이님의 완독률 48/62". 저장(북마크)한 글 중 읽음 처리된 비율.
--   읽을 생각으로 담아둔 글이 분모다. 전체 글을 분모로 잡으면 영원히 0% 라 아무 동기도 안 된다.
create or replace function public.my_read_rate(p_user_id uuid)
returns table (saved bigint, finished bigint)
language sql stable security definer set search_path = public as $$
  select
    (select count(*) from public.article_bookmarks b where b.user_id = p_user_id)::bigint,
    (select count(*) from public.article_bookmarks b
       join public.article_reads r on r.article_id = b.article_id and r.user_id = p_user_id
     where b.user_id = p_user_id)::bigint;
$$;

-- ============================================================================
-- 35) 완독률 분모 교체 — 북마크 → 아카이브
-- ----------------------------------------------------------------------------
-- 북마크(저장)와 아카이브(분류)를 하나로 합쳤다. 버튼 두 개가 나란히 있으면
-- "둘이 뭐가 다르지"를 매번 생각해야 하고, 실제로는 저장만 하고 분류는 안 해서
-- 두 숫자가 계속 어긋났다. 이제 담는 곳은 아카이브 하나뿐이다.
--
-- ⚠️ `article_bookmarks` 테이블과 기존 행은 **지우지 않는다.** 앱이 안 쓸 뿐이다.
--    되돌리기 쉽게 남겨둔다(§4 안 하는 것과 같은 방침).
create or replace function public.my_read_rate(p_user_id uuid)
returns table (saved bigint, finished bigint)
language sql stable security definer set search_path = public as $$
  with mine as (
    -- 한 글이 여러 아카이브에 담겨도 하나로 센다.
    select distinct aa.article_id
    from public.archive_articles aa
    join public.archives a on a.id = aa.archive_id
    where a.user_id = p_user_id
  )
  select
    (select count(*) from mine)::bigint,
    (select count(*) from mine
       join public.article_reads r
         on r.article_id = mine.article_id and r.user_id = p_user_id)::bigint;
$$;


-- ============================================================================
-- 36) 주제 대분류 교체 — 개발자 언어에서 기획자 언어로 (기준 v1)
-- ----------------------------------------------------------------------------
-- 옛 주제(dev/product/design/planning/data_ai/infra/career/marketing)는 **개발자가 만든 말**이었다.
-- "인프라", "데이터/AI" 같은 칸은 비개발자가 무엇이 들어 있는지 짐작하지 못한다.
-- 비개발자가 끝까지 읽게 만들겠다면서 정작 고르는 칸이 개발자 언어였다.
--
-- 새 대분류 7개는 **결론이 무엇인가**로 나눈다(docs/분류-기준-v1.md):
--   품질·위험 관리 → AI 활용 → 제품·서비스 기획 → 데이터·실험
--   → 사용자 이해·경험 → 사업·브랜드 → 협업·프로세스
-- 위에서부터 처음 "예"가 나오는 칸이 대분류다. "예"라고 답하려면
-- **본문에서 근거 문장을 그대로 인용**할 수 있어야 한다(못 하면 예가 아니다).
--
-- ⚠️ 이관은 추측하지 않는다. 사람이 245건을 판정한 결과(docs/분류-결과-245.csv)를
--    url 로 맞춰 그대로 넣는다. 그 표에 없는 글은 null 로 남고, 수집기가 다시 판정한다.
-- 재실행 안전: 같은 값을 다시 써도 결과가 같다.

-- 36-1) 새 값 집합을 먼저 허용한다(기존 값도 당분간 함께 허용 — 이관 중 위반 방지).
alter table public.articles drop constraint if exists articles_topic_check;
alter table public.articles add constraint articles_topic_check
  check (topic is null or topic in (
    'ai_use','product_plan','data_exp','user_exp','biz_brand','collab','quality_risk',
    'dev','product','design','planning','data_ai','infra','career','marketing'
  ));

alter table public.user_topics drop constraint if exists user_topics_topic_check;
alter table public.user_topics add constraint user_topics_topic_check
  check (topic in (
    'ai_use','product_plan','data_exp','user_exp','biz_brand','collab','quality_risk',
    'dev','product','design','planning','data_ai','infra','career','marketing'
  ));

-- 36-2) 사람이 판정한 245건을 url 로 맞춰 이관한다.
update public.articles a set topic = v.topic
from (values
  ('https://seed-design.io/updates/why-we-hired-a-design-engineer', 'collab'),
  ('https://toss.tech/article/tech_talk_talk_1', 'quality_risk'),
  ('https://seed-design.io/updates/pickers-dialog-select', 'product_plan'),
  ('https://medium.com/daangn/%EC%8B%A4%ED%97%98%EC%9D%84-%EB%8D%94-%ED%8E%B8%ED%95%98%EA%B2%8C-%EC%84%A4%EA%B3%84%ED%95%A0-%EC%88%98-%EC%9E%88%EA%B2%8C-%EB%8B%B9%EA%B7%BC-%EC%8B%A4%ED%97%98%ED%94%8C%EB%9E%AB%ED%8F%BC-%EC%9D%B4%EC%95%BC%EA%B8%B0-3fa344b4391b', 'data_exp'),
  ('https://aws.amazon.com/ko/blogs/tech/a1mobilsoft-ops-automation-1/', 'ai_use'),
  ('https://toss.tech/article/llm_context_topic', 'ai_use'),
  ('https://d2.naver.com/helloworld/4821538', 'ai_use'),
  ('https://oliveyoung.tech/2026-07-24/offline-payment-upgrade-phase1/', 'user_exp'),
  ('https://medium.com/daangn/%ED%94%84%EB%A1%A0%ED%8A%B8%EC%97%94%EB%93%9C%EC%99%80-%EB%B0%B1%EC%97%94%EB%93%9C%EB%A5%BC-%ED%95%9C-%ED%8C%80%EC%9C%BC%EB%A1%9C-%ED%95%A9%EC%B9%98%EB%A9%B4-%EC%96%B4%EB%96%A4-%EC%9D%BC%EC%9D%B4-%EC%9D%BC%EC%96%B4%EB%82%A0%EA%B9%8C-f8b32edb2eb1', 'collab'),
  ('https://techblog.musinsa.com/match%EB%9E%80-%EB%AC%B4%EC%97%87%EC%9D%B8%EA%B0%80-5776910908af', 'product_plan'),
  ('https://careers.daangn.com/blog/post/behind-cafe-team-relay/', 'product_plan'),
  ('https://blog.gangnamunni.com/post/config2026', 'ai_use'),
  ('https://d2.naver.com/helloworld/1883072', 'ai_use'),
  ('https://seed-design.io/updates/why-design-system-needs-branding', 'biz_brand'),
  ('https://techblog.woowahan.com/26459/', 'ai_use'),
  ('https://d2.naver.com/helloworld/2541696', 'ai_use'),
  ('https://blog.gangnamunni.com/post/rebranding-2026-5-behind', 'biz_brand'),
  ('https://blog.gangnamunni.com/post/rebranding-2026-4-campaign', 'biz_brand'),
  ('https://careers.daangn.com/blog/post/behind-recruit-site-renewal/', 'biz_brand'),
  ('https://blog.gangnamunni.com/post/rebranding-2026-3-product', 'biz_brand'),
  ('https://blog.gangnamunni.com/post/rebranding-2026-2-visual', 'biz_brand'),
  ('https://blog.gangnamunni.com/post/rebranding-2026-1-BIS', 'biz_brand'),
  ('https://medium.com/daangn/%ED%98%BC%EC%9E%90-%EC%8B%9C%EC%9E%91%ED%95%B4-%EC%A0%84%EA%B5%AD-%EC%98%A4%ED%94%88%EA%B9%8C%EC%A7%80-%EB%8B%B9%EA%B7%BC-%EB%A0%88%EC%8A%A8-%EA%B3%BC%EC%99%B8-%EB%B9%8C%EB%94%A9-%EB%A1%9C%EA%B7%B8-d4e61f6ba32f', 'product_plan'),
  ('https://techblog.woowahan.com/26379/', 'data_exp'),
  ('https://toss.tech/article/50893', 'quality_risk'),
  ('https://toss.tech/article/technical-writing-6', 'collab'),
  ('https://toss.tech/article/technical-writing-5', 'ai_use'),
  ('https://toss.tech/article/technical-writing-4', 'collab'),
  ('https://toss.tech/article/technical-writing-3', 'collab'),
  ('https://toss.tech/article/ai_contest', 'ai_use'),
  ('https://toss.tech/article/technical-writing-2', 'product_plan'),
  ('https://toss.tech/article/technical-writing-1', 'collab'),
  ('https://toss.tech/article/todolist', 'ai_use'),
  ('https://toss.tech/article/chatbot', 'ai_use'),
  ('https://tech.cloud.nongshim.co.kr/blog/aws/ai/4129/', 'ai_use'),
  ('https://seed-design.io/updates/how-seed-evolved', 'user_exp'),
  ('https://toss.tech/article/deadend', 'ai_use'),
  ('https://toss.tech/article/tues', 'data_exp'),
  ('https://tech.kakao.com/posts/823', 'ai_use'),
  ('https://medium.com/daangn/%EB%94%94%EC%9E%90%EC%9D%B8%EC%8B%9C%EC%8A%A4%ED%85%9C-%ED%8C%80%EC%9D%80-%EB%94%94%EC%9E%90%EC%9D%B8%EC%8B%9C%EC%8A%A4%ED%85%9C%EB%A7%8C-%EC%9E%98-%EB%A7%8C%EB%93%A4%EB%A9%B4-%EB%90%A0%EA%B9%8C-4f6f2478a8db', 'ai_use'),
  ('https://toss.tech/article/tam-connect-2025', 'quality_risk'),
  ('https://careers.daangn.com/blog/post/interview-commerce-team/', 'product_plan'),
  ('https://tech.cloud.nongshim.co.kr/blog/aws/3921/', 'ai_use'),
  ('https://tech.cloud.nongshim.co.kr/blog/aws/3891/', 'quality_risk'),
  ('https://medium.com/daangn/%EB%88%84%EA%B5%AC%EB%82%98-%EC%B0%BE%EC%95%84%EB%B3%BC-%EC%88%98-%EC%9E%88%EB%8A%94-%EC%A4%91%EA%B3%A0%EA%B1%B0%EB%9E%98-%EC%84%9C%EB%B2%84-llm-%EB%A6%B4%EB%A6%AC%EC%A6%88-%EB%85%B8%ED%8A%B8-%EB%8F%84%EC%9E%85%EA%B8%B0-93afe203d766', 'ai_use'),
  ('https://careers.daangn.com/blog/post/당근-신입-프로덕트-디자이너-인턴/', 'user_exp'),
  ('https://blog.gangnamunni.com/post/ax-voyage-2026', 'ai_use'),
  ('https://techblog.musinsa.com/%EB%AC%B4%EC%8B%A0%EC%82%AC-%EB%A9%94%EA%B0%80%EC%8A%A4%ED%86%A0%EC%96%B4-%EC%84%B1%EC%88%98-%EB%B3%B4%EC%9D%B4%EC%A7%80-%EC%95%8A%EB%8A%94-%EA%B8%B0%EC%88%A0-%EC%84%A0%EB%AA%85%ED%95%B4%EC%A7%80%EB%8A%94-%EA%B2%BD%ED%97%98-a1976d599e83', 'product_plan'),
  ('https://medium.com/daangn/%ED%94%84%EB%A1%AC%ED%94%84%ED%8A%B8-%ED%95%9C-%EC%A4%84%EB%A1%9C-%ED%99%94%EB%A9%B4%EC%9D%B4-%EB%82%98%EC%98%A4%EB%8A%94-%EC%8B%9C%EB%8C%80-%EB%8B%B9%EA%B7%BC%EC%8A%A4%EB%9F%AC%EC%9A%B4-%ED%99%94%EB%A9%B4%EC%9D%84-%EB%A7%8C%EB%93%9C%EB%8A%94-%EB%B2%95-0bc268f819c7', 'ai_use'),
  ('https://careers.daangn.com/blog/post/당근-인턴-회의봇-당번이-비개발자-ai/', 'ai_use'),
  ('https://techblog.musinsa.com/the-human-%EC%A0%90%EC%88%98-%EB%84%88%EB%A8%B8%EC%9D%98-%ED%8C%90%EB%8B%A8-bccc190c9c93', 'ai_use'),
  ('https://helloworld.kurly.com/blog/claude-code-redesign-my-day/', 'ai_use'),
  ('https://oliveyoung.tech/2026-04-16/oliveyoung-tech-ai-dlc-workshop/', 'ai_use'),
  ('https://techblog.musinsa.com/gemini-%EA%B8%B0%EB%B0%98-%ED%85%8C%EC%8A%A4%ED%8A%B8-%EC%BC%80%EC%9D%B4%EC%8A%A4-%EC%9E%90%EB%8F%99%ED%99%94-%EC%8B%A4%ED%8C%A8%EC%99%80-%EC%84%B1%EA%B3%B5%EA%B8%B0-5d558317f2a5', 'ai_use'),
  ('https://www.bucketplace.com/post/2026-04-10-ai-%EC%8B%9C%EB%8C%80-%EA%B0%80%EC%9E%A5-%ED%9D%A5%EB%AF%B8%EB%A1%9C%EC%9A%B4-%EB%AC%B8%EC%A0%9C%EB%8A%94-%EC%8A%A4%ED%81%AC%EB%A6%B0-%EB%B0%96%EC%97%90%EC%9E%88%EB%8B%A4/', 'biz_brand'),
  ('https://www.bucketplace.com/post/2026-04-09-%EA%B8%B0%EB%A1%9D%EC%97%90-%EB%A8%B8%EB%AC%BC%EB%8D%98-%EB%A1%9C%EA%B7%B8%EB%8A%94-%EC%96%B4%EB%96%BB%EA%B2%8C-%E2%80%98%EC%9E%90%EC%82%B0%E2%80%99%EC%9D%B4-%EB%90%98%EC%97%88%EC%9D%84%EA%B9%8C/', 'data_exp'),
  ('https://techblog.musinsa.com/self-pos-%EB%AC%B4%EC%9D%B8-%EA%B3%84%EC%82%B0%EB%8C%80-%EB%AC%B4%EC%8B%A0%EC%82%AC%EB%8B%A4%EC%9A%B4-%EC%98%A4%ED%94%84%EB%9D%BC%EC%9D%B8-%EA%B3%A0%EA%B0%9D%EA%B2%BD%ED%97%98%EC%9D%84-%EC%84%A4%EA%B3%84%ED%95%98%EB%8B%A4-586169f788c7', 'product_plan'),
  ('https://techblog.woowahan.com/26162/', 'ai_use'),
  ('https://helloworld.kurly.com/blog/ai-orchestration-1/', 'ai_use'),
  ('https://www.bucketplace.com/post/2026-03-31-%EB%82%AF%EC%84%A0-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8%EB%A5%BC-%ED%91%B8%EB%8A%94-%EC%83%88%EB%A1%9C%EC%9A%B4-%ED%8C%8C%ED%8A%B8%EB%84%88-ai-%EA%B3%BC%EC%99%B8%EC%84%A0%EC%83%9D%EB%8B%98/', 'ai_use'),
  ('https://blog.gangnamunni.com/post/ai-discovery-collaboration', 'collab'),
  ('https://techblog.woowahan.com/25888/', 'ai_use'),
  ('https://techblog.woowahan.com/26034/', 'ai_use'),
  ('https://blog.gangnamunni.com/post/brandmarketing-self-esteem', 'biz_brand'),
  ('https://techblog.woowahan.com/25900/', 'ai_use'),
  ('https://tech.cloud.nongshim.co.kr/blog/aws/ai/3854/', 'ai_use'),
  ('https://oliveyoung.tech/2026-03-06/delivery-optimization/', 'product_plan'),
  ('https://oliveyoung.tech/2026-02-27/2026-02-27-oliveyoung-store-journey-renewal-ux/', 'user_exp'),
  ('https://www.bucketplace.com/post/2026-02-24-%EB%A6%AC%EC%86%8C%EC%8A%A4-8%EB%B0%B0-%EC%A0%88%EA%B0%90-ai%EB%A1%9C-%ED%95%B4%EA%B2%B0%ED%95%9C-%EB%A1%9C%EC%BB%AC%EB%9D%BC%EC%9D%B4%EC%A6%88-%EB%8C%80%EA%B3%B5%EC%82%AC/', 'ai_use'),
  ('https://careers.daangn.com/blog/post/당근-커뮤니티실-모임-커리어-채용-팀문화/', 'user_exp'),
  ('https://www.bucketplace.com/post/2026-02-06-%EC%8B%A0%EB%A2%B0%ED%95%A0-%EC%88%98-%EC%9E%88%EB%8A%94-%EB%A9%94%ED%8A%B8%EB%A6%AD%EA%B3%BC-%EC%8B%A4%ED%97%98-%ED%94%8C%EB%9E%AB%ED%8F%BC/', 'data_exp'),
  ('https://www.bucketplace.com/post/2026-02-04-%EA%B3%B5%EA%B0%84%EC%9D%98-%EB%B3%80%ED%99%94-%EC%A6%90%EA%B1%B0%EC%9A%B4-%EA%B3%A0%EB%AF%BC%EB%A7%8C-%ED%95%A0-%EC%88%98-%EC%9E%88%EB%8F%84%EB%A1%9D/', 'biz_brand'),
  ('https://techblog.woowahan.com/25189/', 'quality_risk'),
  ('https://blog.banksalad.com/pnc/banksalad-welcome-kit/', 'biz_brand'),
  ('https://careers.daangn.com/blog/post/당근-중고거래실-엔지니어-커리어/', 'ai_use'),
  ('https://tech.cloud.nongshim.co.kr/blog/etc/3620/', 'ai_use'),
  ('https://careers.daangn.com/blog/post/당근-에이전시-세일즈-매니저-커리어/', 'biz_brand'),
  ('https://www.bucketplace.com/post/2026-01-05-%EC%98%A4%EB%8A%98%EC%9D%98%EC%A7%91-ai%EB%A1%9C-%EC%9D%BC%ED%95%98%EB%8A%94-%EB%B0%A9%EC%8B%9D%EC%9D%84-%EB%8B%A4%EC%8B%9C-%EC%93%B0%EB%8B%A4/', 'ai_use'),
  ('https://blog.gangnamunni.com/post/return-from-parental-leave', 'collab'),
  ('https://techblog.woowahan.com/25049/', 'product_plan'),
  ('https://helloworld.kurly.com/blog/oms-claude-ai-workflow/', 'ai_use'),
  ('https://blog.banksalad.com/pnc/fintechweek-2025/', 'ai_use'),
  ('https://www.bucketplace.com/post/2025-12-12-%EA%B2%80%EC%83%89/%EB%94%94%EC%8A%A4%ED%94%8C%EB%A0%88%EC%9D%B4-%EA%B4%91%EA%B3%A0-%EB%82%B4%EC%9E%AC%ED%99%94-%ED%94%84%EB%A1%9C%EC%A0%9D%ED%8A%B8/', 'data_exp'),
  ('https://techblog.woowahan.com/24820/', 'collab'),
  ('https://www.bucketplace.com/post/2025-12-09-%EB%A6%AC%EC%84%9C%EC%B9%98%EC%9D%98-%EB%A7%88%EC%A7%80%EB%A7%89-%ED%8D%BC%EC%A6%90-%ED%95%A8%EA%BB%98-%EC%9D%BC%ED%95%98%EB%8A%94-%EC%82%AC%EB%9E%8C%EB%93%A4/', 'user_exp'),
  ('https://oliveyoung.tech/2025-12-08/creating-video-with-ai/', 'ai_use'),
  ('https://techblog.woowahan.com/24605/', 'user_exp'),
  ('https://tech.kakao.com/posts/799', 'ai_use'),
  ('https://www.bucketplace.com/post/2025-12-04-%EC%98%A4%EB%8A%98%EC%9D%98%EC%A7%91-%EB%A6%AC%EB%B8%8C%EB%9E%9C%EB%94%A9-%EB%B9%84%ED%95%98%EC%9D%B8%EB%93%9C-%EC%8A%A4%ED%86%A0%EB%A6%AC-%E2%91%A2-%EC%9D%B8%ED%84%B0%EB%B7%B0/', 'biz_brand'),
  ('https://helloworld.kurly.com/blog/tech-spec-adoption-with-ai-automation/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-모바일-엔지니어-채용/', 'user_exp'),
  ('https://www.bucketplace.com/post/2025-12-02-%EC%98%A4%EB%8A%98%EC%9D%98%EC%A7%91-%EB%A0%8C%EC%A6%88-%ED%85%8D%EC%8A%A4%ED%8A%B8%EB%A5%BC-%EB%84%98%EC%96%B4-%EC%9D%B4%EB%AF%B8%EC%A7%80%EB%A1%9C-%ED%99%95%EC%9E%A5%EB%90%98%EB%8A%94-%EA%B2%80%EC%83%89-%EA%B2%BD%ED%97%98/', 'product_plan'),
  ('https://www.bucketplace.com/post/2025-11-25-%EC%98%A4%EB%8A%98%EC%9D%98%EC%A7%91-%EC%A0%84%EC%82%AC-%EC%A7%80%EC%8B%9D-%ED%83%90%EC%83%89-%EC%8B%9C%EC%8A%A4%ED%85%9C-%E2%80%98ori-%EC%98%A4%EB%A6%AC-%E2%80%99-%EA%B0%9C%EB%B0%9C%EA%B8%B0/', 'ai_use'),
  ('https://tech.kakao.com/posts/795', 'collab'),
  ('https://www.bucketplace.com/post/2025-11-20-%EC%98%A4%EB%8A%98%EC%9D%98%EC%A7%91-%EB%A6%AC%EB%B8%8C%EB%9E%9C%EB%94%A9-%EB%B9%84%ED%95%98%EC%9D%B8%EB%93%9C-%EC%8A%A4%ED%86%A0%EB%A6%AC-%E2%91%A1/', 'biz_brand'),
  ('https://www.bucketplace.com/post/2025-11-20-%EC%98%A4%EB%8A%98%EC%9D%98%EC%A7%91-%EB%A6%AC%EB%B8%8C%EB%9E%9C%EB%94%A9-%EB%B9%84%ED%95%98%EC%9D%B8%EB%93%9C-%EC%8A%A4%ED%86%A0%EB%A6%AC-%E2%91%A0/', 'biz_brand'),
  ('https://tech.kakao.com/posts/796', 'collab'),
  ('https://tech.kakao.com/posts/791', 'ai_use'),
  ('https://www.bucketplace.com/post/2025-11-13-%EC%A0%95%ED%95%B4%EC%A7%84-%EB%8B%B5%EC%9D%B4-%EC%97%86%EB%8A%94-%EC%98%81%EC%97%AD%EC%97%90%EC%84%9C-%EC%98%A4%EB%8A%98%EC%9D%98%EC%A7%91%EC%9D%98-%EC%98%A4%EB%A6%AC%EC%A7%80%EB%84%90%EB%A6%AC%ED%8B%B0%EB%A5%BC-%EC%8C%93%EC%95%84%EA%B0%80%EB%8B%A4/', 'biz_brand'),
  ('https://techblog.woowahan.com/23836/', 'ai_use'),
  ('https://www.bucketplace.com/post/2025-11-06-%EC%98%A4%EB%8A%98%EC%9D%98%EC%A7%91%EC%9D%80-%EC%96%B4%EB%96%BB%EA%B2%8C-200%EB%AA%85%EC%9D%98-%EB%A6%AC%EC%84%9C%EC%B2%98%EB%A5%BC-%EB%A7%8C%EB%93%A4%EC%97%88%EC%9D%84%EA%B9%8C/', 'user_exp'),
  ('https://tech.kakao.com/posts/790', 'ai_use'),
  ('https://tech.kakao.com/posts/784', 'ai_use'),
  ('https://tech.kakao.com/posts/783', 'ai_use'),
  ('https://techblog.woowahan.com/23377/', 'collab'),
  ('https://oliveyoung.tech/2025-10-17/review-of-orderpay-squad/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-커뮤니티실-커리어-채용-팀문화/', 'user_exp'),
  ('https://techblog.woowahan.com/23273/', 'ai_use'),
  ('https://oliveyoung.tech/2025-09-24/wms-pda-web-app/', 'user_exp'),
  ('https://oliveyoung.tech/2025-09-24/API-testing-v1/', 'quality_risk'),
  ('https://www.bucketplace.com/post/2025-09-24-%EB%B0%80%EB%8F%84-%EC%9E%88%EA%B2%8C-%EC%84%B1%EC%9E%A5%ED%95%98%EB%A9%B0-%EC%83%88%EB%A1%9C%EC%9A%B4-%EA%B0%80%EB%8A%A5%EC%84%B1%EC%9D%98-%EB%AC%B8%EC%9D%84-%EC%97%B4%EB%8B%A4/', 'user_exp'),
  ('https://blog.gangnamunni.com/post/focus-on-problems-not-features-chat-consulting-improvement', 'user_exp'),
  ('https://tech.kakao.com/posts/762', 'ai_use'),
  ('https://tech.kakao.com/posts/761', 'ai_use'),
  ('https://tech.kakao.com/posts/759', 'quality_risk'),
  ('https://tech.kakao.com/posts/758', 'ai_use'),
  ('https://careers.daangn.com/blog/post/당근-광고실-프로덕트-매니저-커리어/', 'product_plan'),
  ('https://tech.kakao.com/posts/727', 'ai_use'),
  ('https://tech.kakao.com/posts/723', 'ai_use'),
  ('https://www.bucketplace.com/post/2025-09-19-%EC%97%B0%EA%B2%B0%EC%9D%98-%EC%8B%9C%EB%84%88%EC%A7%80-%EC%98%A4%EB%8A%98%EC%9D%98%EC%A7%91-%E2%80%98%EC%BB%A4%EB%AE%A4%EB%8B%88%ED%8B%B0%E2%80%99-%EC%8A%A4%EC%BF%BC%EB%93%9C-%ED%98%91%EC%97%85%EA%B8%B0/', 'collab'),
  ('https://tech.kakao.com/posts/738', 'quality_risk'),
  ('https://tech.kakao.com/posts/741', 'quality_risk'),
  ('https://blog.gangnamunni.com/post/why-standardize-review-info-1-writing', 'user_exp'),
  ('https://oliveyoung.tech/2025-09-08/gms-qa-strategy/', 'quality_risk'),
  ('https://careers.daangn.com/blog/post/당근-광고실-세일즈-커리어/', 'biz_brand'),
  ('https://blog.banksalad.com/tech/banksalad-vibe-coding/', 'ai_use'),
  ('https://oliveyoung.tech/2025-09-04/article-editor/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근-프로덕트디자이너-pd-인턴-커리어/', 'user_exp'),
  ('https://www.bucketplace.com/post/2025-08-29-%ED%95%9C-%EB%B0%9C-%EC%95%9E%EC%84%A0-%EC%8B%9C%EC%84%A0%EC%9C%BC%EB%A1%9C-%ED%95%A8%EA%BB%98-%EB%8D%94-%EB%A9%80%EB%A6%AC-%EB%82%98%EC%95%84%EA%B0%80%EB%8A%94-%EB%B2%95/', 'collab'),
  ('https://tech.kakaopay.com/post/building-ai-loan-coaching-service/', 'ai_use'),
  ('https://tech.kakao.com/posts/720', 'ai_use'),
  ('https://careers.daangn.com/blog/post/당근-마케팅-오프라인-캠페인-플리마켓/', 'biz_brand'),
  ('https://oliveyoung.tech/2025-08-01/logistics-system/', 'product_plan'),
  ('https://tech.kakao.com/posts/719', 'ai_use'),
  ('https://www.bucketplace.com/post/2025-07-22-%EB%A6%AC%EC%84%9C%EC%B2%98%EA%B0%80-%EB%B0%98%EB%B3%B5%EC%9D%84-%EB%8D%9C%EA%B3%A0-%E2%80%98%ED%86%B5%EC%B0%B0%E2%80%99%EC%97%90-%EB%8D%94-%EC%A7%91%EC%A4%91%ED%95%A0-%EC%88%98-%EC%9E%88%EB%8B%A4%EB%A9%B4/', 'ai_use'),
  ('https://medium.com/naver-dna-tech-blog/naver-search-self-serve-83ca658a3c6f', 'data_exp'),
  ('https://blog.banksalad.com/tech/the-illusion-of-supporting-accessibility/', 'quality_risk'),
  ('https://blog.gangnamunni.com/post/eean', 'collab'),
  ('https://www.bucketplace.com/post/2025-06-30-%ED%95%98%EB%82%98%EC%9D%98-%EB%8B%B5%EC%97%90%EC%84%9C-%EB%98%90-%EB%8B%A4%EB%A5%B8-%EC%A7%88%EB%AC%B8%EC%9C%BC%EB%A1%9C/', 'data_exp'),
  ('https://oliveyoung.tech/2025-06-19/journey-to-joining-oliveyoung-qa/', 'quality_risk'),
  ('https://blog.gangnamunni.com/post/ios-skan-performance', 'data_exp'),
  ('https://tech.cloud.nongshim.co.kr/blog/aws/ai/3108/', 'ai_use'),
  ('https://blog.gangnamunni.com/post/medical_standardization', 'product_plan'),
  ('https://oliveyoung.tech/2025-05-29/dplot-qa-docs/', 'quality_risk'),
  ('https://oliveyoung.tech/2025-05-23/app-review-system/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근-ai-프로덕트-조직문화-사용자경험/', 'ai_use'),
  ('https://careers.daangn.com/blog/post/당근-로컬맵스-동네지도-사용자경험-채용-팀문화/', 'product_plan'),
  ('https://oliveyoung.tech/2025-02-28/oy-workshop-2024/', 'collab'),
  ('https://oliveyoung.tech/2025-02-14/oy-global-mall-address/', 'user_exp'),
  ('https://tech.kakaopay.com/post/choonsiri/', 'ai_use'),
  ('https://careers.daangn.com/blog/post/당근-프로덕트-디자이너-인턴-커리어/', 'user_exp'),
  ('https://careers.daangn.com/blog/post/당근-개발자-프로덕트-엔지니어-팀빌딩-회고/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-개발자-목적조직-프로덕트-엔지니어/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-피드실-채용-홈화면-개발자-pm/', 'user_exp'),
  ('https://tech.kakaopay.com/post/ifkakao2024-instant-insurance-claim-payment/', 'product_plan'),
  ('https://seed-design.io/updates/whats-new-in-action-button', 'user_exp'),
  ('https://careers.daangn.com/blog/post/당근-광고실-개발자-서버-엔지니어-dsp/', 'biz_brand'),
  ('https://medium.com/naver-dna-tech-blog/data-analytics-in-the-gpt-era-5e4496acedff', 'ai_use'),
  ('https://careers.daangn.com/blog/post/당근-해커톤-개발자-몰입-협업/', 'ai_use'),
  ('https://oliveyoung.tech/2024-09-06/introduce-oy-po/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근-동네생활-커뮤니티-사용자경험-채용-팀문화/', 'user_exp'),
  ('https://careers.daangn.com/blog/post/당근-로컬비즈니스-몰입-채용-팀문화/', 'biz_brand'),
  ('https://careers.daangn.com/blog/post/당근페이-카드출시-하나카드-동네금융-브랜딩/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근-광고-개발자-dsp/', 'biz_brand'),
  ('https://careers.daangn.com/blog/post/부동산-직거래-해커톤-피처톤/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-리브랜딩-프로세스-브랜드/', 'biz_brand'),
  ('https://careers.daangn.com/blog/post/당근-리더십-채용-팀문화/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-부동산-실험문화-채용-팀문화/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근-중고차-직거래-실험문화-사용자경험-팀문화/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근-광고실-채용-목표달성-매출-팀문화/', 'biz_brand'),
  ('https://careers.daangn.com/blog/post/당근-문화의-날-조직문화-문화회의-문화활동-피플팀/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-선거-서비스-tf-우리-동네-투표율/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근-실험-문화-pm-데이터/', 'data_exp'),
  ('https://medium.com/naver-dna-tech-blog/%EC%83%9D%EC%84%B1%ED%98%95-%EA%B2%80%EC%83%89-%EB%8D%B0%EB%AA%A8%EC%97%90%EC%84%9C-%EC%84%9C%EB%B9%84%EC%8A%A4%EB%A1%9C-b6e5de32c009', 'ai_use'),
  ('https://careers.daangn.com/blog/post/당근-리더-인터뷰-중고거래실-리더십-조직문화/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근-리더-인터뷰-공통서비스개발팀-리더십-조직문화/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-리더-인터뷰-로컬비즈니스실-리더십-조직문화/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-리더-인터뷰-검색실-리더십-조직문화/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-리더-인터뷰-당근알바-리더십-조직문화/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근-채팅팀-채용-비전-문화/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근-리브랜딩-비하인드-스토리/', 'biz_brand'),
  ('https://medium.com/naver-dna-tech-blog/%EB%A8%B8%EC%8B%A0%EB%9F%AC%EB%8B%9D%EC%9D%84-%ED%99%9C%EC%9A%A9%ED%95%9C-%EA%B2%80%EC%83%89-%ED%92%88%EC%A7%88-%EC%A7%80%ED%91%9C-%EA%B0%9C%EB%B0%9C-sigir23-paper-recap-6090914005a8', 'data_exp'),
  ('https://oliveyoung.tech/2024-01-23/incident/', 'quality_risk'),
  ('https://careers.daangn.com/blog/post/당근-프로덕트디자이너-채용-인터뷰/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-pm-프로덕트매니저-채용-인터뷰/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근-ml-머신러닝엔지니어-채용-인터뷰/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-데이터분석가-채용-인터뷰/', 'data_exp'),
  ('https://oliveyoung.tech/2023-12-19/self-checkout/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근-광고실-동네-사장님-광고/', 'biz_brand'),
  ('https://careers.daangn.com/blog/post/당근-워크샵-문화의날-회의/', 'collab'),
  ('https://careers.daangn.com/blog/post/사용자중심-kpt-회고-당근-팀문화/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-소프트웨어-개발자-서비스-운영개발-운영실-팀문화/', 'collab'),
  ('https://careers.daangn.com/blog/post/프로덕트-디자이너-면접후기-이직-커리어-채용/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-프로덕트-디자이너-8년차-커리어-채용/', 'collab'),
  ('https://tech.kakaopay.com/post/bluetooth-remittance/', 'product_plan'),
  ('https://oliveyoung.tech/2023-10-10/oliveyoung-pickup-cart/', 'user_exp'),
  ('https://careers.daangn.com/blog/post/당근-ceo-대표-인터뷰-비전-기업문화/', 'biz_brand'),
  ('https://careers.daangn.com/blog/post/당근-기능-개선-업데이트-새소식-2023-상반기/', 'product_plan'),
  ('https://oliveyoung.tech/2022-12-24/live-squard-with-agile/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-리브랜딩-서비스명-로고-리뉴얼/', 'biz_brand'),
  ('https://careers.daangn.com/blog/post/3일-동안-3년-내다보기/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근알바-성장-비결-okr-pmf/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근마켓-마케팅-조직문화-회고/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근마켓-it-개발-협업-pm-개발자-디자이너/', 'collab'),
  ('https://tech.kakaopay.com/post/dictionary-bot/', 'product_plan'),
  ('https://medium.com/naver-dna-tech-blog/%EC%83%9D%EC%84%B1%ED%98%95-ai%EC%99%80-%EB%8D%B0%EC%9D%B4%ED%84%B0-%EC%82%AC%EC%9D%B4%EC%96%B8%EC%8A%A4%EC%9D%98-%EB%AF%B8%EB%9E%98-672b659e0a10', 'ai_use'),
  ('https://tech.kakaopay.com/post/bella-cmx-platform-segmentation/', 'data_exp'),
  ('https://medium.com/naver-dna-tech-blog/chatgpt%EC%99%80-%EA%B2%80%EC%83%89%EC%9D%98-%EB%AF%B8%EB%9E%98-60dd438cee64', 'quality_risk'),
  ('https://careers.daangn.com/blog/post/당근마켓-프로덕트-디자이너-채용-당프소/', 'collab'),
  ('https://oliveyoung.tech/2022-12-16/performance-marketing/', 'collab'),
  ('https://oliveyoung.tech/2022-12-07/planning-poker/', 'collab'),
  ('https://tech.kakaopay.com/post/accessibility-stories-for-everyone/', 'user_exp'),
  ('https://careers.daangn.com/blog/post/당근마켓-매너온도-해외시장-진출-2/', 'user_exp'),
  ('https://careers.daangn.com/blog/post/당근마켓-매너온도-해외시장-진출-1/', 'user_exp'),
  ('https://careers.daangn.com/blog/post/당근-pm-채용-실험문화-데이터/', 'data_exp'),
  ('https://careers.daangn.com/blog/post/당근알바-탄생배경/', 'product_plan'),
  ('https://careers.daangn.com/blog/post/당근마켓-실험문화-데이터가치화팀/', 'data_exp'),
  ('https://careers.daangn.com/blog/post/당근-pm-인터뷰-2022-전직군채용/', 'collab'),
  ('https://careers.daangn.com/blog/post/당근-프로덕트디자이너-인터뷰-2022-전직군채용/', 'collab'),
  ('https://oliveyoung.tech/2021-09-09/How-Alldev-Work/', 'collab'),
  ('https://careers.daangn.com/blog/post/마스크-대란-사태-당근마켓-가격제한/', 'product_plan'),
  ('https://blog.gangnamunni.com/post/Maximize-reusability-with-component-design', 'collab'),
  ('https://blog.gangnamunni.com/post/Kill-the-Company', 'quality_risk'),
  ('https://www.bucketplace.com/post/2026-05-11-%EB%B8%8C%EB%9E%9C%EB%94%A9-%ED%94%84%EB%A1%9C%EB%AA%A8%EC%85%98%EC%9D%84-%ED%95%98%EB%82%98%EC%9D%98-%E2%80%98%EC%84%B8%EA%B3%84%EA%B4%80%E2%80%99%EC%9C%BC%EB%A1%9C-%EC%84%A4%EA%B3%84%ED%95%9C%EB%8B%A4%EB%8A%94-%EA%B2%83/', 'ai_use'),
  ('https://www.bucketplace.com/post/2026-05-06-%EB%94%94%EC%9E%90%EC%9D%B4%EB%84%88%EA%B0%80-ai%EB%A5%BC-%EC%93%B0%EB%8A%94-%EB%B2%95-%EB%8D%94-%EB%B9%A0%EB%A5%B4%EA%B2%8C-%EA%B3%A0%EB%AF%BC%ED%95%98%EA%B3%A0-%EB%8D%94-%EA%B9%8A%EA%B2%8C-%EA%B2%80%EC%A6%9D%ED%95%98%EA%B8%B0/', 'ai_use'),
  ('https://www.bucketplace.com/post/2026-05-08-%EC%9E%AC%EB%AC%B4%EC%9D%98-%EB%B9%97%EC%9E%A5%EC%9D%84-%ED%92%80%EC%96%B4-%EB%8D%B0%EC%9D%B4%ED%84%B0%EC%9D%98-%ED%98%B8%EC%88%98%EB%A1%9C/', 'ai_use'),
  ('https://www.bucketplace.com/post/2026-06-12-%EB%88%84%EA%B5%AC%EB%82%98-60%EC%A0%90%EC%9D%84-%EB%A7%8C%EB%93%9C%EB%8A%94-%EC%8B%9C%EB%8C%80%EC%97%90-%ED%94%84%EB%A1%9C%EB%8D%95%ED%8A%B8-%EB%94%94%EC%9E%90%EC%9D%B4%EB%84%88%EA%B0%80-%EB%8D%98%EC%A0%B8%EC%95%BC-%ED%95%A0-%EC%A7%84%EC%A7%9C-%EC%A7%88%EB%AC%B8/', 'ai_use'),
  ('https://www.bucketplace.com/post/2026-04-24-%EB%94%94%EC%9E%90%EC%9D%B4%EB%84%88%EC%9D%98-%E2%80%98%EA%B0%90%EA%B0%81%E2%80%99%EC%9D%B4-ai%EB%A5%BC-%EB%A7%8C%EB%82%98-%E2%80%98%EC%8B%9C%EC%8A%A4%ED%85%9C%E2%80%99%EC%9D%B4-%EB%90%A0-%EB%95%8C/', 'ai_use'),
  ('https://www.bucketplace.com/post/2026-04-23-%EB%94%94%EC%9E%90%EC%9D%B4%EB%84%88%EB%8A%94-%EC%96%B4%EB%96%BB%EA%B2%8C-%EB%8B%A8-2%EC%A3%BC-%EB%A7%8C%EC%97%90-ai%EB%A1%9C-%EA%B0%80%EC%84%A4%EC%9D%84-%EC%A6%9D%EB%AA%85%ED%95%B4-%EB%83%88%EC%9D%84%EA%B9%8C/', 'ai_use'),
  ('https://www.bucketplace.com/post/2026-07-08-ureka-%EC%A0%9C%EC%9E%91%EA%B8%B0-%EC%9D%B8%EC%82%AC%EC%9D%B4%ED%8A%B8%EB%8A%94-%EC%96%B4%EB%96%BB%EA%B2%8C-%EC%A1%B0%EC%A7%81%EC%9D%98-%EC%9E%90%EC%82%B0%EC%9D%B4-%EB%90%A0%EA%B9%8C/', 'ai_use'),
  ('https://www.bucketplace.com/post/2026-05-29-%EB%B0%98%EB%B3%B5%EB%90%98%EB%8A%94-%EC%96%B4%EB%93%9C%EB%AF%BC-%EB%94%94%EC%9E%90%EC%9D%B8-prd%EB%A1%9C-%EC%96%B4%EB%94%94%EA%B9%8C%EC%A7%80-%EC%9E%90%EB%8F%99%ED%99%94%ED%95%A0-%EC%88%98-%EC%9E%88%EC%9D%84%EA%B9%8C/', 'ai_use')
) as v(url, topic)
where a.url = v.url;

-- 36-3) 제외 판정된 글 — 지우지 않고 주제를 비운다.
--   지우면 그 글에 달린 인사이트·밑줄·담기까지 사라진다. 목록에서 안 보이게 하는 것으로 충분하다.
--   (앱은 주제 필터를 쓰고, 주제가 빈 글은 '제외' 취급한다.)
update public.articles a set topic = null
from (values
  ('https://tech.kakao.com/posts/825'),
  ('https://d2.naver.com/helloworld/6647064'),
  ('https://d2.naver.com/helloworld/0107009'),
  ('https://oliveyoung.tech/2025-12-17/QA-Conference-2025/'),
  ('https://tech.kakao.com/posts/797'),
  ('https://careers.daangn.com/blog/post/당근-해커톤-엔지니어-채용/'),
  ('https://tech.kakaopay.com/post/how-llm-works/'),
  ('https://oliveyoung.tech/2024-11-22/designsystem-development/'),
  ('https://careers.daangn.com/blog/post/당근-조직문화-피플팀-자율-학습문화-인턴십/'),
  ('https://oliveyoung.tech/2024-04-01/goods-detail-description-improvement/'),
  ('https://oliveyoung.tech/2023-10-11/offline-store-settlement/'),
  ('https://careers.daangn.com/blog/post/당근마켓-프로덕트-디자이너-지원팁-7문-7답/'),
  ('https://oliveyoung.tech/2021-01-23/App-Part-Work-Process-Establishment/'),
  ('https://tech.kakaopay.com/post/tam-connect/')
) as v(url)
where a.url = v.url;

-- 36-4) 표에 없던 글 — 옛 값을 비운다.
--   245건은 사람이 판정한 표가 있지만, 그 뒤 수집된 글은 표에 없어서 옛 값이 그대로 남는다.
--   옛 값을 새 값으로 **기계적으로 바꾸지 않는다.** "인프라 → 품질·위험 관리" 같은 매핑은
--   결론을 보지 않은 추측이고, 기준 v1 의 판단 순서를 정면으로 어긴다.
--   비워두면 classify 단계(LLM 판정 3회 + 다수결)가 본문을 읽고 다시 정한다.
--
--   얼마나 남았는지 먼저 보려면:
--     select topic, count(*) from public.articles
--      where topic in ('dev','product','design','planning','data_ai','infra','career','marketing')
--      group by topic order by 2 desc;
update public.articles set topic = null
where topic in ('dev','product','design','planning','data_ai','infra','career','marketing');

-- 관심 주제는 비울 수 없다(PK 의 일부). 옛 값 행은 지운다 — 사용자가 다시 고르면 된다.
delete from public.user_topics
where topic in ('dev','product','design','planning','data_ai','infra','career','marketing');

-- 36-5) 이제 옛 값은 더 이상 받지 않는다.
--   ⚠️ 이 블록은 **위 update·delete 가 끝난 뒤** 실행해야 한다. 남은 옛 값이 있으면 실패하는데,
--      그건 안전장치다 — 이관이 덜 됐다는 뜻이므로 제약을 조이면 안 된다.
alter table public.articles drop constraint if exists articles_topic_check;
alter table public.articles add constraint articles_topic_check
  check (topic is null or topic in
    ('ai_use','product_plan','data_exp','user_exp','biz_brand','collab','quality_risk'));

alter table public.user_topics drop constraint if exists user_topics_topic_check;
alter table public.user_topics add constraint user_topics_topic_check
  check (topic in
    ('ai_use','product_plan','data_exp','user_exp','biz_brand','collab','quality_risk'));

-- 이관 결과 확인:
--   select coalesce(topic,'(미분류)') as topic, count(*)
--     from public.articles group by 1 order by 2 desc;
-- '(미분류)' 가 남는 건 정상이다 — classify 단계가 본문을 읽고 채운다.

-- ============================================================================
-- 37) 태그 — 대표(목적) 1개 + 세부(방법·제품상황·기술)
-- ----------------------------------------------------------------------------
-- 지금 tags 에 들어 있는 값(#성능 #AWS #모니터링 #테스트)은 **옛 키워드 분류기**가
-- 본문에 나온 단어를 집어 넣은 것이다. 기술 이름이 태그가 되면 결국 개발자 언어로 돌아간다.
--
-- 기준 v1(docs/분류-기준-v1.md 4단계)은 태그를 네 갈래로 나눈다:
--   목적(11) 필수 1개 · 방법(34) 1~2개 · 제품·상황(21) 0~2개 · 기술(5) 0~2개
-- 이 중 **목적**이 대표 태그다 — "이 글이 무엇을 하려던 글인가"라서 혼자서도 뜻이 통한다.
-- 나머지 셋은 세부 태그로 tags 에 함께 담는다(검색·필터용).
--
-- ⚠️ 대분류(topic)와 역할이 다르다. 대분류는 **결론**으로 나눈 칸이고,
--    태그는 그 안에서 다시 찾기 위한 색인이다. 태그로 대분류를 정하지 않는다.
alter table public.articles add column if not exists purpose_tag text
  check (purpose_tag is null or purpose_tag in (
    '전환','접근성','활성화','이탈','신뢰','속도','안정화','효율화','품질','사용성','일관성'
  ));

create index if not exists idx_articles_purpose on public.articles(purpose_tag);

-- 옛 키워드 태그를 비운다 — 새 어휘로 다시 채운다(classify 단계).
--   기술 이름 태그는 그대로 두면 새 태그와 섞여 필터가 두 벌이 된다.
update public.articles set tags = '{}' where tags <> '{}';

-- ============================================================
-- §38. 자동 처리 시도 시각 — 크론이 **같은 글에 갇히지 않게** 한다.
--
-- 크론은 "아직 요약 없는 글 1건"을 골라 부른다. 그런데 어떤 글은 몇 번을 돌려도
-- 게이트를 통과하지 못한다(본문이 토막 나 있거나, 모델이 계속 같은 실수를 하거나).
-- 정렬이 published_at 뿐이면 **그 한 글이 매 시간 다시 뽑혀** 하루 치 토큰을 통째로 태운다.
-- 실제로 일일 한도를 한 번 태운 적이 있어서, 같은 방식으로 또 당하지 않게 막아 둔다.
--
-- 그래서 고를 때마다 시도 시각을 찍고 **안 해본 글 → 오래전에 해본 글** 순으로 돈다.
-- 성공하면 reading_guide/topic 이 채워져 후보에서 빠지므로 따로 지울 필요가 없다.
-- ============================================================
alter table public.articles add column if not exists guide_tried_at timestamptz;
alter table public.articles add column if not exists classify_tried_at timestamptz;

-- 후보 고르기 전용 인덱스 — nulls first 정렬을 그대로 태운다.
create index if not exists idx_articles_guide_try
  on public.articles (guide_tried_at nulls first, published_at desc nulls last);
create index if not exists idx_articles_classify_try
  on public.articles (classify_tried_at nulls first, published_at desc nulls last);

-- ============================================================
-- §39. blogs.frameable — 이 블로그를 **아이프레임 안에 띄울 수 있나.**
--
-- 웹에는 웹뷰가 없다. 남의 페이지를 내 화면에 넣는 수단은 iframe 하나뿐이고,
-- `X-Frame-Options` 는 서버가 브라우저에게 내리는 명령이라 클라이언트가 못 피한다.
-- 더 나쁜 건 **막혔다는 걸 클라이언트가 감지할 수 없다**는 점이다(크로스오리진이라 안을 못 보고
-- onError 도 안 온다). 그래서 예전엔 눌러야 빈 화면을 만났고, 안내조차 못 띄웠다.
--
-- 그래서 서버가 **미리 확인해** 여기에 적어 둔다. 앱은 누르기 전에 올바른 문을 고른다:
--   true  → 웹에서도 앱 안 iframe
--   false → 새 탭(웹에서는 브라우저가 곧 앱이다)
--   null  → 아직 모름. **새 탭으로 보낸다** — 모르는 채로 iframe 을 걸면 빈 화면이 나오는데,
--           그건 "안 열린다"보다 나쁘다(무엇이 잘못됐는지 알 수 없다).
--
-- 실측(2026-09-21, 19곳): 7곳 차단(네이버 D2 DENY · DNA · 플레이스 · 페이, 쿠팡, 무신사, AWS).
-- ============================================================
alter table public.blogs add column if not exists frameable boolean;
alter table public.blogs add column if not exists frameable_checked_at timestamptz;

-- ============================================================
-- §40. 시리즈 — **여러 편으로 나뉜 글을 한 묶음으로 본다.**
--
-- 시리즈 중간편은 그 편만 열면 무슨 이야기인지 알 수 없다. "왜 만들었나"는 1편에만 있고
-- 중간편은 구현만 다루는 일이 흔하다. 그렇다고 중간편을 빼면 이야기가 끊긴다 —
-- 그래서 **빼지 않고, 상세에서 같은 시리즈를 함께 보여준다.**
--
-- 왜 컬럼인가: 제목으로 매번 계산할 수는 있지만, "같은 시리즈 글 찾기"를 하려면
-- LIKE 검색이 되어 느리고 부정확하다. 키를 적어 두면 `series_key = ?` 한 번이면 된다.
--
-- ⚠️ 정본은 `src/lib/series.ts` 의 `seriesOf()` 다. 이 컬럼은 그 결과를 적어 둔 것이라,
--    규칙을 고치면 `npm run series` 로 다시 채워야 한다.
--
-- 실측(2026-09-22): 시리즈 23개 · 글 56건.
--   리브랜딩 비하인드 5편 · 올리브영 결제 이야기 4편 · 10년 된 레거시를 현대화하다 3편 …
-- ============================================================
alter table public.articles add column if not exists series_key text;
alter table public.articles add column if not exists series_no int;

-- 상세에서 "같은 시리즈 글"을 찾는 경로. 블로그까지 함께 봐야
-- 제목이 겹치는 남의 글과 섞이지 않는다.
create index if not exists idx_articles_series
  on public.articles (blog_id, series_key, series_no)
  where series_key is not null;
