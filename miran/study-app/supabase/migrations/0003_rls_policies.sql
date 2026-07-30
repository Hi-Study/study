-- ============================================================
-- 0003 · RLS 활성화 + 정책
-- 규칙 출처: dev/schema.md "RLS 핵심 규칙" + dev/api.md 권한 컬럼.
--
-- 핵심:
--   · study 하위 데이터: 해당 study 멤버만 select/insert  (is_study_member)
--   · studies/멤버/코드 변경: owner 만                    (is_study_owner / RPC)
--   · 본인 글·댓글·좋아요만 수정/삭제. 단 owner 는 스터디 내 모든
--     글/댓글 delete 가능(중재)  (신고 기능 없음)
--   · 멤버 가입/탈퇴/위임은 RPC(SECURITY DEFINER)로만 → 직접 insert/update 미허용
--
-- ⚠️ 재실행 안전(idempotent): 각 정책은 drop if exists 후 재생성.
-- ============================================================

alter table public.users          enable row level security;
alter table public.studies        enable row level security;
alter table public.study_members  enable row level security;
alter table public.shares         enable row level security;
alter table public.discussions    enable row level security;
alter table public.comments       enable row level security;
alter table public.likes          enable row level security;
alter table public.notifications  enable row level security;

-- ---------------- users ----------------
-- 프로필(이름/직급/아바타)은 스터디 전반에서 표시되므로 로그인 사용자 조회 허용.
drop policy if exists users_select on public.users;
create policy users_select on public.users
  for select to authenticated using (true);

drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- insert 는 handle_new_user 트리거(SECURITY DEFINER)가 담당. 방어적 self-insert 허용.
drop policy if exists users_insert_self on public.users;
create policy users_insert_self on public.users
  for insert to authenticated with check (id = auth.uid());

-- ---------------- studies ----------------
drop policy if exists studies_select_member on public.studies;
create policy studies_select_member on public.studies
  for select to authenticated using (public.is_study_member(id));

-- 생성은 create_study RPC 사용 권장. 직접 insert 시에도 owner 는 본인만.
drop policy if exists studies_insert_owner on public.studies;
create policy studies_insert_owner on public.studies
  for insert to authenticated with check (owner_id = auth.uid());

drop policy if exists studies_update_owner on public.studies;
create policy studies_update_owner on public.studies
  for update to authenticated
  using (public.is_study_owner(id)) with check (public.is_study_owner(id));

drop policy if exists studies_delete_owner on public.studies;
create policy studies_delete_owner on public.studies
  for delete to authenticated using (public.is_study_owner(id));

-- ---------------- study_members ----------------
-- 같은 스터디 멤버끼리 서로의 멤버십 조회 가능 (멤버 목록 화면).
drop policy if exists members_select on public.study_members;
create policy members_select on public.study_members
  for select to authenticated using (public.is_study_member(study_id));

-- 강퇴: owner 가 본인 외 멤버 삭제. (본인 탈퇴는 leave_study RPC 사용)
drop policy if exists members_delete_owner on public.study_members;
create policy members_delete_owner on public.study_members
  for delete to authenticated
  using (public.is_study_owner(study_id) and user_id <> auth.uid());

-- 참여/위임/생성 시 insert·update 는 RPC(SECURITY DEFINER)로만 수행 → 정책 없음.

-- ---------------- shares ----------------
drop policy if exists shares_select_member on public.shares;
create policy shares_select_member on public.shares
  for select to authenticated using (public.is_study_member(study_id));

drop policy if exists shares_insert_member on public.shares;
create policy shares_insert_member on public.shares
  for insert to authenticated
  with check (public.is_study_member(study_id) and author_id = auth.uid());

-- OG/요약 등 서버 채움은 service_role(RLS 우회). 클라는 본인 글만 수정.
drop policy if exists shares_update_own on public.shares;
create policy shares_update_own on public.shares
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- 본인 글 or owner(중재) 삭제.
drop policy if exists shares_delete_own_or_owner on public.shares;
create policy shares_delete_own_or_owner on public.shares
  for delete to authenticated
  using (author_id = auth.uid() or public.is_study_owner(study_id));

-- ---------------- discussions ----------------
drop policy if exists disc_select_member on public.discussions;
create policy disc_select_member on public.discussions
  for select to authenticated using (public.is_study_member(study_id));

drop policy if exists disc_insert_member on public.discussions;
create policy disc_insert_member on public.discussions
  for insert to authenticated
  with check (public.is_study_member(study_id) and author_id = auth.uid());

-- 본인 글 수정, 또는 owner(결론 고정 conclusion_comment_id 지정 등).
drop policy if exists disc_update_own_or_owner on public.discussions;
create policy disc_update_own_or_owner on public.discussions
  for update to authenticated
  using (author_id = auth.uid() or public.is_study_owner(study_id))
  with check (author_id = auth.uid() or public.is_study_owner(study_id));

drop policy if exists disc_delete_own_or_owner on public.discussions;
create policy disc_delete_own_or_owner on public.discussions
  for delete to authenticated
  using (author_id = auth.uid() or public.is_study_owner(study_id));

-- ---------------- comments ----------------
drop policy if exists comments_select_member on public.comments;
create policy comments_select_member on public.comments
  for select to authenticated using (public.is_study_member(study_id));

drop policy if exists comments_insert_member on public.comments;
create policy comments_insert_member on public.comments
  for insert to authenticated
  with check (public.is_study_member(study_id) and author_id = auth.uid());

drop policy if exists comments_update_own on public.comments;
create policy comments_update_own on public.comments
  for update to authenticated
  using (author_id = auth.uid()) with check (author_id = auth.uid());

-- 본인 댓글 or owner(중재) 삭제.
drop policy if exists comments_delete_own_or_owner on public.comments;
create policy comments_delete_own_or_owner on public.comments
  for delete to authenticated
  using (author_id = auth.uid() or public.is_study_owner(study_id));

-- ---------------- likes ----------------
drop policy if exists likes_select_member on public.likes;
create policy likes_select_member on public.likes
  for select to authenticated using (public.is_study_member(study_id));

drop policy if exists likes_insert_own on public.likes;
create policy likes_insert_own on public.likes
  for insert to authenticated
  with check (public.is_study_member(study_id) and user_id = auth.uid());

drop policy if exists likes_delete_own on public.likes;
create policy likes_delete_own on public.likes
  for delete to authenticated using (user_id = auth.uid());

-- ---------------- notifications ----------------
-- 본인 알림만 조회/읽음처리/삭제. insert 는 서버(Edge Function/트리거)가 담당.
drop policy if exists notif_select_own on public.notifications;
create policy notif_select_own on public.notifications
  for select to authenticated using (user_id = auth.uid());

drop policy if exists notif_update_own on public.notifications;
create policy notif_update_own on public.notifications
  for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notif_delete_own on public.notifications;
create policy notif_delete_own on public.notifications
  for delete to authenticated using (user_id = auth.uid());
