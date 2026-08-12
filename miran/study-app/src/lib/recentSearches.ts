// distill 검색 — 최근 검색어(로컬 저장). AsyncStorage 기반, 최신순 중복 제거 후 최대 N개.
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "distill.recentSearches";
const MAX = 8;

/** 순수 병합 로직(테스트 대상) — term 을 맨 앞에 두고 중복 제거, 최대 MAX 개. */
export function mergeRecent(list: string[], term: string, max: number = MAX): string[] {
  const t = term.trim();
  if (!t) return list;
  return [t, ...list.filter((x) => x !== t)].slice(0, max);
}

export async function getRecentSearches(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(arr) ? arr.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function save(list: string[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {
    // 저장 실패는 조용히 무시(최근검색어는 부가 기능).
  }
}

export async function addRecentSearch(term: string): Promise<string[]> {
  const next = mergeRecent(await getRecentSearches(), term);
  await save(next);
  return next;
}

export async function removeRecentSearch(term: string): Promise<string[]> {
  const next = (await getRecentSearches()).filter((x) => x !== term);
  await save(next);
  return next;
}

export async function clearRecentSearches(): Promise<void> {
  await save([]);
}

/** 최근 검색어 상태 훅 — 마운트 시 로드, add/remove/clear 로 갱신. */
export function useRecentSearches() {
  const [recents, setRecents] = useState<string[]>([]);
  useEffect(() => {
    getRecentSearches().then(setRecents);
  }, []);
  const add = useCallback((t: string) => {
    addRecentSearch(t).then(setRecents);
  }, []);
  const remove = useCallback((t: string) => {
    removeRecentSearch(t).then(setRecents);
  }, []);
  const clear = useCallback(() => {
    clearRecentSearches().then(() => setRecents([]));
  }, []);
  return { recents, add, remove, clear };
}
