// 난이도 배지 — "이 글을 읽을 수 있는지"를 3초 안에 판단하게 한다.
//
// UX 라이팅 원칙 (중요):
//   · **사람을 등급 매기지 않는다.** "개발자용" 같은 라벨은 비개발자를 밀어내고 클릭을 줄인다.
//     대신 '글의 성격'을 말한다 — "코드까지 들어가요".
//   · **빨강을 쓰지 않는다.** 빨강은 경고/실패 신호라 "깊은 글 = 나쁜 글"로 읽힌다.
//     깊이는 벌점이 아니다.
//   · 배지는 **거르는 장치가 아니라 기대치를 맞추는 장치**다. 대기업 검증 사례를 보여준다는
//     서비스 방향과 부딪히지 않게, 어려운 글을 숨기지 않고 미리 알려주기만 한다.
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { LEVEL_META, dtype } from "@/theme";
import type { ArticleLevel } from "@/types/database";

interface Props {
  level: ArticleLevel | null | undefined;
  /** 예상 읽기 시간(분). 있으면 배지 옆에 "· 7분". */
  readMinutes?: number | null;
  /** 상세 화면용 — 배지 아래 한 줄 설명까지 보여준다. */
  withHint?: boolean;
  size?: "sm" | "md";
}

/** 난이도 배지(+ 읽기 시간). level 이 없으면 읽기 시간만, 그것도 없으면 아무것도 안 그린다. */
export function LevelBadge({ level, readMinutes, withHint = false, size = "sm" }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const meta = level ? LEVEL_META[level] : null;
  const mins = readMinutes && readMinutes > 0 ? `${readMinutes}분` : null;

  if (!meta && !mins) return null;

  const small = size === "sm";

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {meta ? (
          <View
            style={[
              styles.chip,
              { backgroundColor: meta.tint },
              small ? styles.chipSm : styles.chipMd,
            ]}
          >
            <Text
              style={[small ? styles.textSm : styles.textMd, { color: meta.color }]}
              numberOfLines={1}
            >
              {meta.label}
            </Text>
          </View>
        ) : null}
        {mins ? (
          <Text style={[styles.mins, { color: c.textMuted }]}>
            {meta ? `· ${mins}` : mins}
          </Text>
        ) : null}
      </View>
      {withHint && meta ? (
        <Text style={[styles.hint, { color: c.textMuted }]}>{meta.hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: { borderRadius: 6, alignSelf: "flex-start" },
  chipSm: { paddingHorizontal: 7, paddingVertical: 3 },
  chipMd: { paddingHorizontal: 9, paddingVertical: 5 },
  textSm: { ...dtype.label, fontSize: 11.5 },
  textMd: { ...dtype.label, fontSize: 13 },
  mins: { ...dtype.meta },
  hint: { ...dtype.meta },
});
