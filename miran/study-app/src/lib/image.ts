// 이미지 URL 안전 인코딩 — RN Image 는 한글 등 비ASCII 문자가 그대로 들어간 URL을 못 불러온다.
// (예: 배민 techblog 의 '.../가게목록-지면.jpeg'). 이미 인코딩된 %XX 는 보존한다.
export function safeImageUri(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  try {
    // encodeURI 는 기존 %XX 를 다시 인코딩하지 않고, 한글 등만 퍼센트 인코딩한다.
    return encodeURI(url);
  } catch {
    return url;
  }
}
