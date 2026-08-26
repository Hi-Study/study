// 마이 활동 캘린더 — 이번 달에서 활동(읽음·인사이트·하이라이트·댓글·단어)한 날에 점 표시.
// (회의록 [마이] 캘린더 요소.) 정보/뷰는 유지, 활동 요약을 시각화.
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype } from "@/theme";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export function ActivityCalendar({ activeDays }: { activeDays: Set<string> }) {
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
        <Pressable hitSlop={8} onPress={() => shift(-1)}>
          <ChevronLeft size={20} color={c.textMuted} />
        </Pressable>
        <Text style={[styles.title, { color: c.textPrimary }]}>
          {ym.y}년 {ym.m + 1}월
        </Text>
        <Pressable hitSlop={8} onPress={() => shift(1)}>
          <ChevronRight size={20} color={c.textMuted} />
        </Pressable>
      </View>
      <Text style={[styles.sub, { color: c.textMuted }]}>이번 달 {activeCount}일 활동했어요</Text>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((w, i) => (
          <Text
            key={w}
            style={[styles.weekday, { color: i === 0 ? c.hot : c.textMuted }]}
          >
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
            <View key={i} style={styles.cell}>
              {d != null ? (
                <View
                  style={[
                    styles.dayWrap,
                    active && { backgroundColor: c.primary },
                    !active && isToday && { borderColor: c.primary, borderWidth: 1.5 },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      { color: active ? c.actionOn : isToday ? c.primary : c.textSecondary },
                    ]}
                  >
                    {d}
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, marginBottom: 8 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...dtype.cardTitle },
  sub: { ...dtype.bodyS, marginTop: 4, marginBottom: 12 },
  weekRow: { flexDirection: "row" },
  weekday: { flex: 1, textAlign: "center", fontSize: 11, lineHeight: 16, fontWeight: "700" },
  grid: { flexDirection: "row", flexWrap: "wrap", marginTop: 6 },
  cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: "center", justifyContent: "center" },
  dayWrap: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  dayText: { fontSize: 13, lineHeight: 17, fontWeight: "600" },
});
