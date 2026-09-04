// 난이도 배지 — 글을 열기 전에 "내가 읽을 만한지" 3초 안에 판단하게 한다.
//
// ⚠️ 한 번 지웠다가 되살렸다. 지운 이유는 "terms 가 85%라 변별력이 없다"였는데,
//    그건 **라벨과 판정 기준을 고칠 문제**지 배지를 없앨 이유가 아니었다.
//    라벨을 입문/보통/심화로 바꿔 한눈에 읽히게 한다.
//
// UX 라이팅 규칙:
//   · 사람을 등급 매기지 않는다("개발자용" X) — 글의 깊이를 말한다.
//   · 빨강을 쓰지 않는다. 빨강은 경고라 "깊은 글 = 나쁜 글"로 읽힌다.
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { LEVEL_META, dtype } from "@/theme";
import type { ArticleLevel } from "@/types/database";

interface Props {
  level: ArticleLevel | null | undefined;
  /** 예상 읽기 시간(분). 난이도가 없어도 이것만 있으면 보여준다. */
  readMinutes?: number | null;
  /** 상세 화면용 — 배지 아래 한 줄 설명까지. */
  withHint?: boolean;
}

export function LevelBadge({ level, readMinutes, withHint = false }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const meta = level ? LEVEL_META[level] : null;
  const mins = readMinutes && readMinutes > 0 ? `${readMinutes}분` : null;

  if (!meta && !mins) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {meta ? (
          <View style={[styles.chip, { backgroundColor: meta.tint }]}>
            <Text style={[styles.text, { color: meta.color }]}>{meta.label}</Text>
          </View>
        ) : null}
        {mins ? (
          <Text style={[styles.mins, { color: c.textMuted }]}>{meta ? `· ${mins}` : mins}</Text>
        ) : null}
      </View>
      {withHint && meta ? (
        <Text style={[styles.hint, { color: c.textMuted }]}>{meta.hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 3 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 3, alignSelf: "flex-start" },
  text: { ...dtype.label, fontSize: 11.5 },
  mins: { ...dtype.meta },
  hint: { ...dtype.meta },
});
