/**
 * 이름 해시 기반 아바타 배경색. design/README: `hsl(nameHash, 34%, 44%)`.
 * 같은 이름은 항상 같은 색을 갖도록 결정적(deterministic) 해시 사용.
 */
export function nameHashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) % 360;
  }
  return `hsl(${h}, 34%, 44%)`;
}

/** 아바타 이니셜: 이름 첫 글자(공백 제거). 비면 '?'. */
export function initial(name: string | null | undefined): string {
  const t = (name ?? "").trim();
  return t ? t[0] : "?";
}
