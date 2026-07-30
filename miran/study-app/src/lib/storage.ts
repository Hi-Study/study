import { supabase } from "./supabase";

/**
 * 직접 작성 글 이미지 업로드 (dev/api.md §3: text 글에만 첨부 허용).
 * Storage 버킷 `share-images` 를 미리 생성해야 합니다(supabase/README 참고).
 *
 * RN 에서 파일은 보통 로컬 URI(file://...) 이므로 fetch → ArrayBuffer 로 변환해
 * 업로드합니다.
 */
const BUCKET = "share-images";

export async function uploadShareImage(
  uid: string,
  localUri: string,
  ext = "jpg",
): Promise<string> {
  const res = await fetch(localUri);
  const bytes = await res.arrayBuffer();

  // uid 하위 경로 + 인덱스/타임스탬프는 호출부에서 고유하게 구성 권장.
  const path = `${uid}/${cryptoRandom()}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: `image/${ext === "jpg" ? "jpeg" : ext}`,
    upsert: false,
  });
  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function uploadShareImages(
  uid: string,
  localUris: string[],
): Promise<string[]> {
  return Promise.all(localUris.map((uri) => uploadShareImage(uid, uri)));
}

// Math.random 의존 최소화를 위한 간단 랜덤 문자열(파일명 충돌 방지용).
function cryptoRandom(): string {
  const g = globalThis as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  return `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
}
