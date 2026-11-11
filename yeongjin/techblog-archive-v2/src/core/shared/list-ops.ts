/**
 * 내 목록(북마크·읽은 글·최근 검색어)을 바꾸는 규칙 — 브라우저 사본(local-store.ts)과 서버(api/me/lists)가 같이 쓴다.
 * 그래서 "use client" 없이 둔다(서버에서도 그대로 불러 쓸 수 있게).
 */
export type Key = "bookmarks" | "read" | "recent-search";
export const LIST_KEYS: Key[] = ["bookmarks", "read", "recent-search"];
export const LIST_MAX: Record<Key, number> = { bookmarks: 500, read: 200, "recent-search": 10 };
export type Item = number | string;

export type ListOp =
  | { key: Key; op: "toggle"; value: Item }
  | { key: Key; op: "add"; value: Item }
  | { key: Key; op: "clear" }
  | { key: Key; op: "merge"; items: Item[] };

export function applyOp(list: Item[], op: ListOp): Item[] {
  const max = LIST_MAX[op.key];
  switch (op.op) {
    case "toggle":
      return list.includes(op.value) ? list.filter((x) => x !== op.value) : [op.value, ...list].slice(0, max);
    case "add":
      return [op.value, ...list.filter((x) => x !== op.value)].slice(0, max);
    case "clear":
      return [];
    case "merge":
      // 서버에 있던 순서를 지키고, 이 브라우저에만 있던 것을 뒤에 붙인다
      return [...list, ...op.items.filter((x) => !list.includes(x))].slice(0, max);
  }
}

/** 서버로 들어온 값 검사 — 모양이 다르면 null */
export function parseOp(v: unknown): ListOp | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!LIST_KEYS.includes(o.key as Key)) return null;
  const key = o.key as Key;
  const isItem = (x: unknown): x is Item =>
    key === "recent-search" ? typeof x === "string" && x.length <= 100 : Number.isInteger(x);
  switch (o.op) {
    case "toggle":
    case "add":
      return isItem(o.value) ? { key, op: o.op, value: o.value } : null;
    case "clear":
      return { key, op: "clear" };
    case "merge":
      return Array.isArray(o.items) && o.items.every(isItem) ? { key, op: "merge", items: o.items.slice(0, LIST_MAX[key]) } : null;
    default:
      return null;
  }
}
