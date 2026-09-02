// 마이 활동 캘린더 — 활동(읽음·인사이트·하이라이트·댓글·단어)한 날을 **원형**으로 채워 표시.
//   · 좌우 화살표로 달 이동
//   · 날짜를 탭하면 그날의 활동 화면(DayActivity)으로 이동
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype , PRETENDARD} from "@/theme";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function ActivityCalendar({
  activeDays,
  onSelectDay,
}: {
  activeDays: Set<string>;
  /** 날짜 탭 → 'YYYY-MM-DD'. 없으면 날짜가 눌리지 않는다. */
  onSelectDay?: (dateKey: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const firstWeekday = new Date(ym.y, ym.m, 1).getDay();
  const daysInMonth = new Date(ym.y, ym.m + 1, 0).getDate();
  const todayKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  const activeCount = [...activeDays].filter((k) => k.startsWith(`${ym.y}-${pad(ym.m + 1)}`)).length;

  const shift = (delta: number) =>
    setYm((p) => {
      const nm = p.m + delta;
      return { y: p.y + Math.floor(nm / 12), m: ((nm % 12) + 12) % 12 };
    });

  return (
    <View style={[styles.card, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
      <View style={styles.head}>
        <Pressable style={styles.navBtn} hitSlop={8} onPress={() => shift(-1)}>
          <ChevronLeft size={20} color={c.textSecondary} />
        </Pressable>
        <Text style={[styles.title, { color: c.textPrimary }]}>
          {ym.y}년 {ym.m + 1}월
        </Text>
        <Pressable style={styles.navBtn} hitSlop={8} onPress={() => shift(1)}>
          <ChevronRight size={20} color={c.textSecondary} />
        </Pressable>
      </View>
      <Text style={[styles.sub, { color: c.textMuted }]}>
        {activeCount}일 활동했어요 · 날짜를 누르면 그날 활동을 볼 수 있어요
      </Text>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text key={w} style={[styles.weekday, { color: i === 0 ? c.hot : c.textMuted }]}>
            {w}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((d, i) => {
          const key = d ? `${ym.y}-${pad(ym.m + 1)}-${pad(d)}` : "";
          const active = d != null && activeDays.has(key);
          const isToday = key === todayKey;
          return (
            <Pressable
              key={i}
              style={styles.cell}
              disabled={d == null || !onSelectDay}
              onPress={() => onSelectDay?.(key)}
            >
              {d != null ? (
                // 활동한 날 = 채운 원 + 흰 글씨. 오늘도 채운 원 + 흰 글씨(활동 없으면 연하게).
                <View
                  style={[
                    styles.dayWrap,
                    (active || isToday) && { backgroundColor: c.primary },
                    !active && isToday && { opacity: 0.45 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: active || isToday ? c.actionOn : c.textSecondary },
                    ]}
                  >
                    {d}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  navBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  title: { ...dtype.cardTitle },
  sub: { ...dtype.meta, marginTop: 2, marginBottom: 12 },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, lineHeight: 16, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  // 정사각형이 아니라 **원**: 가로세로 같은 크기 + borderRadius 999.
  dayWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 13, lineHeight: 18, fontWeight: "600", fontFamily: PRETENDARD["600"] },
});
