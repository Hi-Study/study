// 카드에 붙는 **"~로 ~을 개선한 사례" 한 줄.**
//
// 이게 이 서비스의 핵심 큐레이션이다. "데이터·실험" 같은 카테고리 이름은
// 어느 글에나 붙일 수 있어서 고를 근거가 안 된다. 목록에서 필요한 건
// "이 글이 무엇을 어떻게 해결했나"를 한 문장으로 아는 것이다.
//
//   파티셔닝으로 성능을 개선한 사례 (조회 3초→0.4초)
//   DLQ 프로세스 도입으로 장애 대응을 개선한 사례
//
// ⚠️ 결정 카드가 없거나 방법이 문장처럼 길면 **아무것도 그리지 않는다.**
//    억지 문장을 붙이면 태그가 정보가 아니라 소음이 된다.
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { IMPROVEMENT_META, dtype } from "@/theme";
import { classifyImprovement, improvementSummary } from "@/lib/improvement";

interface Props {
  decision?: unknown;
  title?: string | null;
  tags?: string[] | null;
  /** 여러 줄 허용(글 상세). 기본은 카드용 1줄. */
  lines?: number;
}

export function ImprovementLine({ decision, title, tags, lines = 2 }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const type = classifyImprovement({ decision, title, tags });
  const summary = improvementSummary(decision, type);
  if (!summary || !type) return null;

  const meta = IMPROVEMENT_META[type];

  return (
    <View style={[styles.wrap, { backgroundColor: meta.tint }]}>
      <Text style={styles.emoji}>{meta.emoji}</Text>
      <Text style={[styles.text, { color: meta.color }]} numberOfLines={lines}>
        {summary}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 5,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  emoji: { fontSize: 12, lineHeight: 18 },
  text: { ...dtype.label, fontSize: 12.5, lineHeight: 18, flex: 1 },
});
