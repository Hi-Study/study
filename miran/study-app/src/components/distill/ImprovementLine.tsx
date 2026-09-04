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
//
// ⚠️ **칩이 아니라 문장이다.** 처음엔 개선 유형별 파스텔 배경을 깐 박스로 그렸는데,
//    바로 위 주제 칩과 색이 겹쳐 카드 하나에 파스텔 상자가 두 개 쌓였다.
//    (DESIGN_SYSTEM §0.1 "화면당 강조 요소 1개" / §0.4 "색을 남발하지 않음")
//    색은 주제 칩에 양보하고, 여기는 lucide 아이콘 하나 + 중립색 문장으로 조용히 둔다.
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { IMPROVEMENT_LINE_ICON, dtype } from "@/theme";
import { classifyImprovement, improvementSummary } from "@/lib/improvement";

interface Props {
  decision?: unknown;
  title?: string | null;
  tags?: string[] | null;
  /** 여러 줄 허용(글 상세). 기본은 카드용 2줄. */
  lines?: number;
}

export function ImprovementLine({ decision, title, tags, lines = 2 }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const type = classifyImprovement({ decision, title, tags });
  const summary = improvementSummary(decision, type);
  if (!summary || !type) return null;

  const Icon = IMPROVEMENT_LINE_ICON;

  return (
    <View style={styles.wrap}>
      {/* 아이콘은 lucide line, 16 인라인, textMuted (DESIGN_GUIDE §5) */}
      <Icon size={14} color={c.textMuted} strokeWidth={2} style={styles.icon} />
      <Text style={[styles.text, { color: c.textSecondary }]} numberOfLines={lines}>
        {summary}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  icon: { marginTop: 2 },
  text: { ...dtype.bodyS, flex: 1 },
});
