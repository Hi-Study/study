-- ============================================================
-- 0005 · 이미지 업로드용 Storage 버킷 + 정책
-- 직접 작성 글 사진 첨부(dev/api.md §3). 대시보드에서 만들지 않아도 이 SQL 로 생성됨.
-- "new row violates row-level security policy" 오류는 storage.objects insert 정책 부재 때문 → 아래로 해결.
-- 재실행 안전(idempotent).
-- ============================================================

-- 공개 읽기 버킷 생성
insert into storage.buckets (id, name, public)
values ('share-images', 'share-images', true)
on conflict (id) do nothing;

-- 인증 사용자는 share-images 버킷에 업로드 가능
drop policy if exists "share_images_insert" on storage.objects;
create policy "share_images_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'share-images');

-- 누구나 읽기(공개 이미지 URL)
drop policy if exists "share_images_read" on storage.objects;
create policy "share_images_read" on storage.objects
  for select to public
  using (bucket_id = 'share-images');

-- 본인이 올린 파일만 삭제
drop policy if exists "share_images_delete" on storage.objects;
create policy "share_images_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'share-images' and owner = auth.uid());
