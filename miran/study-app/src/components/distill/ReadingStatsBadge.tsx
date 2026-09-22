// 연속 읽기 배지 + 이번 달 누적 수치.
//
// ⚠️ 설계 규칙 (중요): **끊겨도 0 을 보여주지 않는다.**
//   듀오링고식 streak 은 하루 5분이라 복구가 쉽지만, 15분짜리 아티클은 한 번 밀리면
//   "이번 주는 글렀다"가 되기 쉽다. 0 을 노출하는 순간 벌칙이 된다.
//   그래서 연속이 끊기면 **불꽃만 조용히 사라지고** 누적(이번 달 N일)은 그대로 남는다.
//   잃는 게 없으니 다시 시작할 때 부담도 없다.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { Flame } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype, PRETENDARD } from "@/theme";
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
      <Flame size={12} color={c.primary} strokeWidth={2} />
      <Text style={[styles.pillText, { color: c.primary }]}>{streak}일</Text>
    </View>
  );
}

/**
 * 마이 맨 위 큰 카드 — **연속 읽기**가 주인공이다.
 *
 * 숫자를 크게 쓰는 건 자랑거리를 만들려는 게 아니라, 마이에 들어온 사람이
 * "내가 지금 읽고 있는 사람인가"를 한눈에 확인하고 싶어서다.
 * 연속이 끊겨 있으면 **0 을 띄우지 않고** 다시 시작하자는 말로 바꾼다(파일 머리 규칙).
 */
export function ReadingStreakHero() {
  const { theme } = useTheme();
  const c = theme.colors;
  const { data } = useReadingStats();
  if (!data) return null;

  const streak = data.streakDays;
  // 아래 흰 카드는 **있는 수치만** 넣는다. 0 두 칸을 나란히 두면 시작도 전에 벌점이 된다.
  const cells: { label: string; value: string }[] = [];
  if (data.monthReads > 0) cells.push({ label: "이번 달 읽은 글", value: `${data.monthReads}개` });
  if (data.monthOpinions > 0) cells.push({ label: "남긴 인사이트", value: `${data.monthOpinions}개` });
  if (cells.length === 0 && data.monthDays > 0) {
    cells.push({ label: "이번 달 읽은 날", value: `${data.monthDays}일` });
  }

  return (
    <View style={[styles.hero, { backgroundColor: c.primary }]}>
      <View style={styles.heroTop}>
        <View style={{ flex: 1 }}>
          {streak > 0 ? (
            <>
              <Text style={[styles.heroNum, { color: c.actionOn }]}>
                {streak}
                <Text style={styles.heroUnit}>일</Text>
              </Text>
              <Text style={[styles.heroLabel, { color: c.actionOn }]}>연속으로 읽고 있어요</Text>
            </>
          ) : (
            <>
              <Text style={[styles.heroLead, { color: c.actionOn }]}>오늘 한 편</Text>
              <Text style={[styles.heroLabel, { color: c.actionOn }]}>읽으면 연속이 시작돼요</Text>
            </>
          )}
        </View>
        <View style={[styles.heroBadge, { borderColor: c.primaryOnDark }]}>
          <Flame size={30} color={c.actionOn} strokeWidth={2} />
        </View>
      </View>

      {cells.length > 0 ? (
        <View style={[styles.heroCard, { backgroundColor: c.surfaceCard }]}>
          {cells.map((cell, i) => (
            <View
              key={cell.label}
              style={[styles.cell, i > 0 && { borderLeftWidth: 1, borderLeftColor: c.hairline }]}
            >
              <Text style={[styles.value, { color: c.textPrimary }]}>{cell.value}</Text>
              <Text style={[styles.label, { color: c.textMuted }]} numberOfLines={1}>
                {cell.label}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
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
  pillText: { ...dtype.label },

  // 위아래 요소와 붙지 않게 자체 여백을 갖는다(마이 화면은 gap 이 없는 스택이라).
  // 외부 여백 없음 — 섹션 간격은 화면의 gap 이 정한다.
  hero: { borderRadius: 18, padding: 18, gap: 14 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  heroNum: { fontSize: 42, lineHeight: 50, fontWeight: "800", fontFamily: PRETENDARD["800"] },
  heroUnit: { fontSize: 20, lineHeight: 28, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  heroLead: { fontSize: 26, lineHeight: 36, fontWeight: "800", fontFamily: PRETENDARD["800"] },
  heroLabel: { ...dtype.cardTitle, fontSize: 15 },
  // 뱃지는 채우지 않고 테두리만 — 배경이 이미 primary 라, 안을 채우면 덩어리가 하나로 뭉갠다.
  heroBadge: {
    width: 62,
    height: 62,
    borderRadius: 999,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  heroCard: { flexDirection: "row", borderRadius: 14, paddingVertical: 12 },
  cell: { flex: 1, alignItems: "center", gap: 2 },
  value: { ...dtype.title, fontSize: 19 },
  label: { ...dtype.meta },
});
