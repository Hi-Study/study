/**
 * 마이 활동 스트립 — 활동한 날(읽음·인사이트·하이라이트·댓글·단어)을 **원형**으로 채워 표시.
 *
 * · **한 주(7칸)만** 보여준다. 한 달 그리드는 세로로 길어서, 마이에 들어온 사람이
 *   아래 활동 목록을 보려면 매번 달력을 지나쳐야 했다. 이 화면에서 달력이 답하는 질문은
 *   "이번 달 며칠 읽었나"가 아니라 **"요즘 읽고 있나"** 하나다 — 그건 한 줄이면 된다.
 * · 좌우 화살표로 주 이동 · 날짜를 탭하면 그날의 활동 화면(DayActivity)으로 이동.
 * · 활동 0일이어도 "0일 활동했어요"라고 말하지 않는다 — 숫자가 벌칙처럼 읽힌다.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronLeft, ChevronRight } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype, PRETENDARD } from "@/theme";

// 월요일 시작 — 한 주를 일로 시작하면 주말이 양 끝에 갈라져 "이번 주에 며칠 읽었나"가 안 읽힌다.
const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"];
const pad = (n: number) => String(n).padStart(2, "0");
export const dayKey = (iso: string): string => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** 그 날짜가 속한 주의 **월요일**. getDay(): 일=0 … 토=6 → 월=0 … 일=6 으로 옮겨서 뺀다. */
function mondayOf(d: Date): Date {
  const m = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  return m;
}

export function ActivityCalendar({
  activeDays,
  onSelectDay,
  title,
}: {
  activeDays: Set<string>;
  /** 날짜 탭 → 'YYYY-MM-DD'. 없으면 날짜가 눌리지 않는다. */
  onSelectDay?: (dateKey: string) => void;
  /** 카드 제목(예: "영이님의 달력"). 없으면 제목 줄을 그리지 않는다. */
  title?: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const now = new Date();
  const thisMonday = mondayOf(now);
  const [start, setStart] = useState<Date>(thisMonday);

  const todayKey = keyOf(now);
  const isThisWeek = keyOf(start) === keyOf(thisMonday);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date: d, key: keyOf(d) };
  });
  const last = days[6].date;
  const doneCount = days.filter((d) => activeDays.has(d.key)).length;

  // 주가 달을 넘어가면 양쪽 달을 다 적는다 — "9월 29일 – 5일"만 보면 어느 달인지 알 수 없다.
  const label =
    start.getMonth() === last.getMonth()
      ? `${start.getMonth() + 1}월 ${start.getDate()}일 – ${last.getDate()}일`
      : `${start.getMonth() + 1}월 ${start.getDate()}일 – ${last.getMonth() + 1}월 ${last.getDate()}일`;

  const shift = (deltaDays: number) =>
    setStart((p) => new Date(p.getFullYear(), p.getMonth(), p.getDate() + deltaDays));

  return (
    <View style={styles.wrap}>
      {title ? <Text style={[styles.cardTitle, { color: c.textPrimary }]}>{title}</Text> : null}
      <View style={[styles.card, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
        {/* 머리줄 — 연·월. 참고 디자인처럼 ▾ 하나만 두고, 주 이동 화살표는 그 왼쪽에 붙인다. */}
        <View style={styles.head}>
          <Text style={[styles.title, { color: c.textPrimary }]}>
            {start.getFullYear()}년 {pad(start.getMonth() + 1)}월
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable style={styles.navBtn} hitSlop={8} onPress={() => shift(-7)}>
            <ChevronLeft size={17} color={c.textMuted} />
          </Pressable>
          {/* 다음 주로는 갈 수 없다 — 오지 않은 날을 보여주면 빈 줄을 보고 "안 읽었다"로 읽는다. */}
          <Pressable
            style={styles.navBtn}
            hitSlop={8}
            disabled={isThisWeek}
            onPress={() => shift(7)}
          >
            <ChevronRight size={17} color={isThisWeek ? c.hairline : c.textMuted} />
          </Pressable>
        </View>

        <View style={styles.row}>
          {days.map((d, i) => {
            const active = activeDays.has(d.key);
            const isToday = d.key === todayKey;
            // 아직 오지 않은 날은 연하게 — 활동이 없는 게 아니라 **아직 기회가 안 온 날**이다.
            const future = d.key > todayKey;
            return (
              <Pressable
                key={d.key}
                style={styles.cell}
                disabled={!onSelectDay || future}
                onPress={() => onSelectDay?.(d.key)}
              >
                <Text style={[styles.weekday, { color: isToday ? c.primary : c.textMuted }]}>
                  {WEEKDAYS[i]}
                </Text>
                {/* 활동한 날 = 채운 보라 원 + 흰 글씨. 오늘은 활동이 없으면 테두리만 남긴다
                    (채워버리면 "오늘 읽었다"로 잘못 읽힌다). */}
                <View
                  style={[
                    styles.dayWrap,
                    active && { backgroundColor: c.primary },
                    !active && isToday && { borderWidth: 1.5, borderColor: c.primary },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayText,
                      {
                        color: active
                          ? c.actionOn
                          : isToday
                            ? c.primary
                            : future
                              ? c.textMuted
                              : c.textSecondary,
                      },
                    ]}
                  >
                    {d.date.getDate()}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.foot, { color: doneCount > 0 ? c.textSecondary : c.textMuted }]}>
          {doneCount > 0
            ? `${label} · ${isThisWeek ? "이번 주" : "이 주"} ${doneCount}일 읽었어요`
            : `${label} · 글을 읽은 날이 여기에 쌓여요`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // 외부 여백은 두지 않는다 — 섹션 간격은 화면이 gap 하나로 정한다(들쑥날쑥해지는 원인이었다).
  wrap: { gap: 8 },
  cardTitle: { ...dtype.title },
  card: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  head: { flexDirection: "row", alignItems: "center" },
  navBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  title: { ...dtype.cardTitle },
  row: { flexDirection: "row" },
  cell: { flex: 1, alignItems: "center", gap: 6 },
  weekday: {
    fontSize: 11.5,
    lineHeight: 16,
    fontWeight: "600",
    fontFamily: PRETENDARD["600"],
  },
  // 정사각형이 아니라 **원**: 가로세로 같은 크기 + borderRadius 999.
  dayWrap: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  dayText: { fontSize: 13.5, lineHeight: 18, fontWeight: "600", fontFamily: PRETENDARD["600"] },
  foot: { ...dtype.meta },
});
