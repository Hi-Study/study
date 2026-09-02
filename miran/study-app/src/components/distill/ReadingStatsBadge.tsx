// 연속 읽기 배지 + 이번 달 누적 수치.
//
// ⚠️ 설계 규칙 (중요): **끊겨도 0 을 보여주지 않는다.**
//   듀오링고식 streak 은 하루 5분이라 복구가 쉽지만, 15분짜리 아티클은 한 번 밀리면
//   "이번 주는 글렀다"가 되기 쉽다. 0 을 노출하는 순간 벌칙이 된다.
//   그래서 연속이 끊기면 **불꽃만 조용히 사라지고** 누적(이번 달 N일)은 그대로 남는다.
//   잃는 게 없으니 다시 시작할 때 부담도 없다.
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype } from "@/theme";
import { useReadingStats } from "@/data";

/** 홈 헤더용 작은 알약 — 연속이 있을 때만 보인다. */
export function StreakPill() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { data } = useReadingStats();
  const streak = data?.streakDays ?? 0;
  if (streak <= 0) return null; // 0 은 절대 그리지 않는다.
  return (
    <View style={[styles.pill, { backgroundColor: c.primaryTint }]}>
      <Text style={styles.fire}>🔥</Text>
      <Text style={[styles.pillText, { color: c.primary }]}>{streak}일</Text>
    </View>
  );
}

/** 마이 캘린더 위 3칸 수치 — 이번 달 기준. 연속은 있을 때만 3번째 칸에 붙는다. */
export function ReadingStatsRow() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { data } = useReadingStats();
  if (!data) return null;

  const cells: { label: string; value: string }[] = [
    { label: "이번 달 읽은 글", value: `${data.monthReads}` },
    { label: "인사이트", value: `${data.monthOpinions}` },
  ];
  // 연속이 살아 있으면 연속을, 끊겼으면 "이번 달 읽은 날"을 보여준다(0 을 쓰지 않는다).
  cells.push(
    data.streakDays > 0
      ? { label: "연속", value: `${data.streakDays}일` }
      : { label: "이번 달", value: `${data.monthDays}일` },
  );

  return (
    <View style={[styles.row, { borderColor: c.hairline }]}>
      {cells.map((cell, i) => (
        <View key={cell.label} style={[styles.cell, i > 0 && { borderLeftWidth: 1, borderLeftColor: c.hairline }]}>
          <Text style={[styles.value, { color: c.textPrimary }]}>{cell.value}</Text>
          <Text style={[styles.label, { color: c.textMuted }]} numberOfLines={1}>
            {cell.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 4,
  },
  fire: { fontSize: 12 },
  pillText: { ...dtype.label, fontSize: 12 },

  row: { flexDirection: "row", borderWidth: 1, borderRadius: 14, paddingVertical: 12 },
  cell: { flex: 1, alignItems: "center", gap: 2 },
  value: { ...dtype.title, fontSize: 19 },
  label: { ...dtype.meta },
});
