"use client";

import { useSyncExternalStore } from "react";
import { applyOp, type Item, type Key, type ListOp } from "./list-ops";

export type { Key } from "./list-ops";

/**
 * 내 목록(북마크·읽은 글·최근 검색어) — 로그인한 계정에 저장한다.
 *
 * - 화면은 늘 이 브라우저의 사본(localStorage)을 읽는다 → 바로 반영되고, 서버를 기다리지 않는다.
 * - 바꾸면 사본을 먼저 고치고, 계정과 연결된 상태(owner 가 있음)면 서버(/api/me/lists)에도 같은 변경을 보낸다.
 * - 계정 연결은 AccountSync 가 화면을 열 때마다 맞춘다: 서버 목록을 받아 사본을 덮어쓴다.
 *   · 로그인 전 이 브라우저에 쌓인 기록(owner 없음)은 처음 한 번 계정으로 옮긴다(합치기).
 *   · 다른 계정의 사본이 남아 있으면 버린다(같은 브라우저를 여러 계정이 쓸 때 섞이지 않게).
 *   · 로그아웃 상태면 사본을 비운다.
 * - 서버 표(user_lists)가 아직 없거나 설정이 안 됐으면 예전처럼 이 브라우저에만 저장된다.
 */
const EVENT = "local-list-change";
const OWNER_KEY = "tbp:owner";

function read<T>(key: Key): T[] {
  try {
    return JSON.parse(localStorage.getItem(`tbp:${key}`) ?? "[]") as T[];
  } catch {
    return [];
  }
}

/** 사본만 고친다(서버로 보내지 않음) — AccountSync 가 서버 값을 내려받을 때도 쓴다 */
export function writeLocal<T>(key: Key, v: T[]) {
  try {
    localStorage.setItem(`tbp:${key}`, JSON.stringify(v));
  } catch {
    /* 저장 불가(시크릿 모드 등) — 무시 */
  }
  cache.delete(key);
  window.dispatchEvent(new Event(EVENT));
}

export function getOwner(): string | null {
  try {
    return localStorage.getItem(OWNER_KEY);
  } catch {
    return null;
  }
}
export function setOwner(id: string | null) {
  try {
    if (id) localStorage.setItem(OWNER_KEY, id);
    else localStorage.removeItem(OWNER_KEY);
  } catch {}
}
export function readLocal<T>(key: Key): T[] {
  return read<T>(key);
}

/* ── 서버로 보내기 — 순서가 꼬이지 않게 한 줄로 세워 보낸다 ── */
let queue: Promise<unknown> = Promise.resolve();
/** 바꾼 횟수 — AccountSync 가 받아 온 값이 그 사이 바뀐 사본보다 낡았는지 알아보는 데 쓴다 */
export let localEdits = 0;

export function sendOp(op: ListOp): Promise<Item[] | null> {
  const p = queue.then(async () => {
    try {
      const res = await fetch("/api/me/lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(op),
      });
      if (!res.ok) return null;
      const { items } = (await res.json()) as { items: Item[] };
      return items;
    } catch {
      return null;
    }
  });
  queue = p;
  return p;
}

function change<T extends Item>(next: T[], op: ListOp) {
  localEdits++;
  writeLocal(op.key, next);
  if (!getOwner()) return; // 계정과 아직 연결 전 — AccountSync 가 연결하면서 합쳐 올린다
  void sendOp(op).then((items) => {
    // 서버가 돌려준 최종 목록으로 맞춘다(다른 기기에서 바뀐 것까지 반영). 그 사이 또 바뀌었으면 다음 응답에 맡긴다
    if (items) writeLocal(op.key, items);
  });
}

const cache = new Map<Key, unknown[]>();
const EMPTY: never[] = [];

export function useLocalList<T>(key: Key): T[] {
  return useSyncExternalStore(
    (cb) => {
      // 다른 탭에서 바뀐 경우(storage) 캐시를 비워야 새 값이 보인다
      const onStorage = () => {
        cache.delete(key);
        cb();
      };
      window.addEventListener(EVENT, cb);
      window.addEventListener("storage", onStorage);
      return () => {
        window.removeEventListener(EVENT, cb);
        window.removeEventListener("storage", onStorage);
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
  const op: ListOp = { key, op: "toggle", value: id };
  change(applyOp(read<Item>(key), op), op);
}

export function addFront<T extends Item>(key: Key, v: T) {
  const list = read<Item>(key);
  if (list[0] === v) return; // 이미 맨 앞 — 서버로 보낼 것도 없다
  const op: ListOp = { key, op: "add", value: v };
  change(applyOp(list, op), op);
}

export function clearList(key: Key) {
  const op: ListOp = { key, op: "clear" };
  change([], op);
}
