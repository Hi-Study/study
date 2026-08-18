-- 알림 화면(개별 읽음 토글/삭제)을 위한 삭제 정책 추가.

create policy "notifications_delete_own"
  on public.notifications for delete
  to authenticated
  using (auth.uid() = user_key);
