"use client";

import { useSyncExternalStore } from "react";

/** 로그인 없음 → 이 브라우저에만 저장되는 목록 (북마크·읽은 글·최근 검색어) */
type Key = "bookmarks" | "read" | "recent-search";
const EVENT = "local-list-change";

function read<T>(key: Key): T[] {
  try {
    return JSON.parse(localStorage.getItem(`tbp:${key}`) ?? "[]") as T[];
  } catch {
    return [];
  }
}

function write<T>(key: Key, v: T[]) {
  try {
    localStorage.setItem(`tbp:${key}`, JSON.stringify(v));
  } catch {
    /* 저장 불가(시크릿 모드 등) — 무시 */
  }
  cache.delete(key);
  window.dispatchEvent(new Event(EVENT));
}

const cache = new Map<Key, unknown[]>();
const EMPTY: never[] = [];

export function useLocalList<T>(key: Key): T[] {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT, cb);
      window.addEventListener("storage", cb);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener("storage", cb);
      };
    },
    () => {
      if (!cache.has(key)) cache.set(key, read<T>(key));
      return cache.get(key) as T[];
    },
    () => EMPTY,
  );
}

export function toggleIn(key: Key, id: number) {
  const list = read<number>(key);
  write(key, list.includes(id) ? list.filter((x) => x !== id) : [id, ...list]);
}

export function addFront<T>(key: Key, v: T, max = 50) {
  write(key, [v, ...read<T>(key).filter((x) => x !== v)].slice(0, max));
}

export function clearList(key: Key) {
  write(key, []);
}
