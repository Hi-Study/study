-- "내 댓글"(마이 탭) 조회를 위해 댓글 작성자를 로그인 사용자와 연결한다.

alter table public.comments add column if not exists user_key uuid references auth.users(id);
