// 난이도 배지 — 글을 열기 전에 "내가 읽을 만한지" 3초 안에 판단하게 한다.
//
// ⚠️ 한 번 지웠다가 되살렸다. 지운 이유는 "terms 가 85%라 변별력이 없다"였는데,
//    그건 **라벨과 판정 기준을 고칠 문제**지 배지를 없앨 이유가 아니었다.
//
// UX 라이팅 규칙:
//   · 사람을 등급 매기지 않는다("개발자용" X) — 글의 깊이를 말한다.
//   · 빨강을 쓰지 않는다. 빨강은 경고라 "깊은 글 = 나쁜 글"로 읽힌다.
//   · 라벨은 **"개발 지식이 얼마나 필요한가"** 를 답한다(누구나 이해 가능 / 기초 개발지식
//     필요 / 개발지식 필요). 입문·보통·심화는 "글이 쉬운가"로 읽혀서 축이 어긋났다.
//
// ⚠️ 색을 쓰지 않는다. 난이도 파스텔이 주제 칩 파스텔과 같은 팔레트라
//    카드 안에서 색의 의미가 겹쳤다. 회색 칩 + 라벨만으로 충분히 읽힌다.
// ⚠️ **읽는 시간(N분)은 붙이지 않는다.** 추정치라 맞지도 않고, 카드에서 "15분"이
//    먼저 보이면 긴 글을 미리 포기하게 만든다. 고를 근거는 난이도와 개선 사례 한 줄이다.
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { LEVEL_META, dtype } from "@/theme";
import type { ArticleLevel } from "@/types/database";

interface Props {
  level: ArticleLevel | null | undefined;
  /** 상세 화면용 — 배지 아래 한 줄 설명까지. */
  withHint?: boolean;
}

export function LevelBadge({ level, withHint = false }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const meta = level ? LEVEL_META[level] : null;
  if (!meta) return null;

  return (
    <View style={styles.wrap}>
      <View style={[styles.chip, { backgroundColor: c.surfaceSunken }]}>
        <Text style={[styles.text, { color: c.textSecondary }]} numberOfLines={1}>
          {meta.label}
        </Text>
      </View>
      {withHint ? <Text style={[styles.hint, { color: c.textMuted }]}>{meta.hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  // 옆의 주제 칩(TopicChip)과 같은 규격 — 칩이 두 종류로 보이면 안 된다.
  chip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  text: { ...dtype.label },
  hint: { ...dtype.meta },
});
