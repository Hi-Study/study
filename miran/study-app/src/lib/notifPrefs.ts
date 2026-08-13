// distill 알림 설정(로컬) — 종류별 on/off. AsyncStorage 저장, 목록 필터링에 사용.
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

import type { NotificationKind } from "@/data";

const KEY = "distill.notifPrefs";

export type NotifPrefs = Record<NotificationKind, boolean>;

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  new_article: true,
  comment: true,
  reply: true,
};

export async function getNotifPrefs(): Promise<NotifPrefs> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_NOTIF_PREFS };
    const p = JSON.parse(raw) as Partial<NotifPrefs>;
    return {
      new_article: p.new_article !== false,
      comment: p.comment !== false,
      reply: p.reply !== false,
    };
  } catch {
    return { ...DEFAULT_NOTIF_PREFS };
  }
}

/** 알림 설정 상태 훅 — 로드 + 토글(즉시 저장). */
export function useNotifPrefs() {
  const [prefs, setPrefs] = useState<NotifPrefs>(DEFAULT_NOTIF_PREFS);
  useEffect(() => {
    getNotifPrefs().then(setPrefs);
  }, []);
  const toggle = useCallback((kind: NotificationKind) => {
    setPrefs((prev) => {
      const next = { ...prev, [kind]: !prev[kind] };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => undefined);
      return next;
    });
  }, []);
  return { prefs, toggle };
}
