# 데이터 모델 (Supabase / Postgres)

프로토타입 상태를 실제 스키마로 옮긴 것입니다. 모든 테이블에 RLS 적용, 시간은 `timestamptz`.

## ERD (요약)
```
users ─┬─< study_members >─┬─ studies
       │                    ├─< shares
       │                    ├─< discussions ─< comments (parent_id 자기참조=대댓글)
       │                    └─ (invite: studies.code)
       └─< notifications
likes(user_id, target_type, target_id)  -- 공유글/댓글 좋아요
```

## 테이블
```sql
-- 사용자 프로필 (auth.users와 1:1)
create table users (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '게스트',
  role_title text,                       -- 직급/역할 (예: PM)
  theme text default 'light',            -- 'light' | 'dark' (화면 설정)
  created_at timestamptz default now()
);

-- 스터디
create table studies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  owner_id uuid not null references users(id),
  invite_code char(6) not null unique,   -- 랜덤 6자 (혼동문자 제외). 만료 없음 — 재발급 전까지 유효
  share_cadence text default '주 2회',    -- 매일 1회 / 주 2회 / 주 3회 / 주 5회
  created_at timestamptz default now()
);

-- 멤버십 + 권한
create table study_members (
  study_id uuid references studies(id) on delete cascade,
  user_id uuid references users(id) on delete cascade,
  role text not null default 'member',   -- 'owner' | 'member'
  joined_at timestamptz default now(),
  primary key (study_id, user_id)
);

-- 공유 글 (링크 or 직접작성)
create table shares (
  id uuid primary key default gen_random_uuid(),
  study_id uuid references studies(id) on delete cascade,
  author_id uuid references users(id),
  kind text not null,                    -- 'link' | 'text'
  day_of_week int not null,              -- 0=월 … 6=일
  shared_date date not null,
  title text not null,
  url text,                              -- link
  source text,                           -- 도메인
  og_image text, og_description text,    -- 서버가 채움
  body text,                             -- text (직접작성)
  note text,                             -- link 메모/본문
  image_urls text[],                     -- 직접 작성 글의 첨부 이미지(Storage). link는 og_image 사용
  created_at timestamptz default now()
);

-- 토론 (링크 or 직접), 방장 결론
create table discussions (
  id uuid primary key default gen_random_uuid(),
  study_id uuid references studies(id) on delete cascade,
  author_id uuid references users(id),
  week_label text not null,              -- 표시용 "7월 셋째 주"
  week_start date not null,              -- 그 주 월요일(정렬/월 이동 필터용). 같은 주에 여러 토론 가능
  title text not null,
  prompt text,                           -- 여는 글 요약
  body text,                             -- 여는 글 본문
  kind text not null default 'text',     -- 'link' | 'text'
  url text, source text, og_image text,
  is_active boolean default true,        -- 진행 중
  conclusion_comment_id uuid,            -- 방장이 지정한 결론 (comments.id)
  created_at timestamptz default now()
);

-- 댓글 + 대댓글(parent_id) — 공유글/토론 공용
create table comments (
  id uuid primary key default gen_random_uuid(),
  target_type text not null,             -- 'share' | 'discussion'
  target_id uuid not null,
  parent_id uuid references comments(id) on delete cascade,  -- null=최상위, 값=대댓글
  author_id uuid references users(id),
  text text not null,
  quote text,                            -- 인용 원문(대댓글)
  created_at timestamptz default now()
);

-- 좋아요/공감 (공유글, 댓글, 토론 여는 글)
create table likes (
  user_id uuid references users(id) on delete cascade,
  target_type text not null,             -- 'share' | 'comment' | 'discussion'
  target_id uuid not null,
  created_at timestamptz default now(),
  primary key (user_id, target_type, target_id)
);

-- 알림
create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  type text not null,                    -- 'discussion_pending'|'cadence'|'comment'|'reply'|'member_joined'
  study_id uuid, ref_id uuid,
  text text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);
```

## RLS 핵심 규칙
- 모든 study 하위 데이터: **해당 study의 member만** select/insert.
- `studies` update(주기·이름), 멤버 강퇴/위임, 코드 재발급: **owner만**.
- `discussions.conclusion_comment_id` 지정: **owner만**.
- 본인 `shares`/`comments`/`likes`만 update/delete. 단, **owner는 스터디 내 모든 글/댓글 delete 가능**(중재·삭제 권한 — 신고 기능은 없음).

## 확정 정책 (구현 기준)
- **초대 코드**: 만료 없음. 재발급 시에만 기존 코드 무효(unique 갱신).
- **이미 참여한 코드 재입력**: 에러 아닌 "이미 참여 중" 안내 후 해당 스터디로 이동.
- **방장 나가기**: 다른 멤버가 있으면 **가장 오래된 멤버(joined_at 최소)에게 자동 위임** 후 퇴장; 마지막 멤버면 스터디 삭제. RPC `leave_study`에서 처리.
- **토론 알림**: 스터디 **전원**(전원 참여 전제) — 별도 태그 없음.
- **페이지네이션**: 공유 글·댓글 **무한 스크롤**(keyset, `created_at`/`id` 커서).
- **이미지**: 직접 작성 글에만 첨부 허용(`shares.image_urls`, Storage). 링크는 OG 이미지만.
- **폼 검증**: 필수값·URL 형식·길이 제한 기본 검증(클라+서버 이중).

## 파생값 (뷰 or 쿼리)
- 캘린더 dot: `shares` group by `shared_date`.
- 미참여: 이번 주 active `discussions` 중 내 `comments` 없는 것.
- 공유주기 미달: 이번 주 내 `shares` count < 목표(cadence 파싱).
- 대시보드: 참여 스터디 수, 내 공유 수, 내 의견 수, 미참여 수.
- 좋아요/댓글 수: `likes`/`comments`를 target별 count. 정렬(등록순/좋아요순)은 쿼리 `order by`.
- 토론 월 이동: `discussions.week_start`로 월 범위 필터 · 주차 grouping.
