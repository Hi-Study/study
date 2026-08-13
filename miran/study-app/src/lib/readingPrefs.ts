// distill 읽기 경험 — 글자 크기(전역) + 글별 읽던 위치(이어읽기). AsyncStorage.
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const FONT_KEY = "distill.readingFontScale";
export const FONT_SCALES = [0.9, 1.0, 1.15, 1.3] as const;

/** 본문 글자 크기 배율 훅 — 저장/복원 + 한 단계씩 키우기/줄이기. */
export function useReadingFontScale() {
  const [scale, setScaleState] = useState(1.0);
  useEffect(() => {
    AsyncStorage.getItem(FONT_KEY).then((v) => {
      const n = v ? parseFloat(v) : NaN;
      if (!isNaN(n)) setScaleState(n);
    });
  }, []);
  const setScale = useCallback((s: number) => {
    setScaleState(s);
    AsyncStorage.setItem(FONT_KEY, String(s)).catch(() => undefined);
  }, []);
  const step = useCallback(
    (dir: 1 | -1) => {
      setScaleState((cur) => {
        const idx = FONT_SCALES.reduce(
          (best, s, i) => (Math.abs(s - cur) < Math.abs(FONT_SCALES[best] - cur) ? i : best),
          0,
        );
        const next = FONT_SCALES[Math.min(FONT_SCALES.length - 1, Math.max(0, idx + dir))];
        AsyncStorage.setItem(FONT_KEY, String(next)).catch(() => undefined);
        return next;
      });
    },
    [],
  );
  return { scale, setScale, step };
}

// ---- 글별 읽던 위치(스크롤 y) ----
const posKey = (articleId: string) => `distill.readpos.${articleId}`;

export async function getReadPos(articleId: string): Promise<number> {
  try {
    const v = await AsyncStorage.getItem(posKey(articleId));
    const n = v ? parseFloat(v) : 0;
    return isNaN(n) ? 0 : n;
  } catch {
    return 0;
  }
}

export async function setReadPos(articleId: string, y: number): Promise<void> {
  try {
    await AsyncStorage.setItem(posKey(articleId), String(Math.round(y)));
  } catch {
    // 무시
  }
}

export async function clearReadPos(articleId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(posKey(articleId));
  } catch {
    // 무시
  }
}
