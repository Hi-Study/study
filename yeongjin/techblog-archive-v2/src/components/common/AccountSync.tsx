"use client";

import { useEffect } from "react";
import { getOwner, localEdits, readLocal, sendOp, setOwner, writeLocal } from "@/core/shared/local-store";
import { LIST_KEYS, type Item } from "@/core/shared/list-ops";
import { resetHideRead } from "@/components/common/ReadState";

/**
 * 화면을 열 때 한 번 — 이 브라우저의 목록 사본을 로그인한 계정의 목록으로 맞춘다(규칙: local-store.ts 맨 위).
 * 레이아웃에 두어 어느 화면으로 들어와도 돈다. 로그인·로그아웃은 모두 화면을 새로 여는 이동이라 그때마다 다시 맞춘다.
 */
export function AccountSync() {
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const edits = localEdits;
      const res = await fetch("/api/me/lists", { cache: "no-store" }).catch(() => null);
      if (cancelled || !res) return;

      if (!res.ok) return; // 서버 표가 아직 없음 — 브라우저에만 저장(예전 방식)

      const { userId, lists } = (await res.json()) as { userId: string | null; lists?: Partial<Record<string, Item[]>> };
      if (!userId || !lists) {
        // 로그아웃 상태 — 앞사람 계정의 기록·"읽은 글 빼기" 설정이 남아 보이지 않게 비운다
        if (getOwner()) {
          setOwner(null);
          LIST_KEYS.forEach((k) => writeLocal(k, []));
          resetHideRead();
        }
        return;
      }
      const owner = getOwner();
      for (const k of LIST_KEYS) {
        let items = lists[k] ?? [];
        const local = readLocal<Item>(k);
        if (owner === null && local.length > 0) {
          // 로그인 전부터 이 브라우저에 쌓인 기록 — 계정으로 옮긴다(처음 한 번)
          items = (await sendOp({ key: k, op: "merge", items: local })) ?? [...items, ...local.filter((x) => !items.includes(x))];
        } else if (owner === userId && localEdits !== edits) {
          continue; // 받아 오는 사이 이 화면에서 또 바꿈 — 그 변경의 응답이 최신 목록으로 맞춰 준다
        }
        writeLocal(k, items);
      }
      setOwner(userId); // 이제부터 바꾸는 것은 바로 서버로 간다
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  return null;
}
