// "무엇을 개선한 사례인가" 태그 + 읽기 시간.
//
// 난이도 배지(술술 읽혀요 / 용어 몇 개만 / 코드까지)를 대체한다.
// 난이도는 "용어가 나오는가"가 기준이라 기술블로그에서 변별력이 없었다(85%가 한 칸).
// 이 태그는 "어떤 문제를 어떻게 풀었나"를 말하므로 기획자·디자이너·마케터가
// 목록에서 바로 고를 수 있다.
//
// ⚠️ 분류 신호가 없으면 태그를 안 그린다. 억지로 붙이면 다시 소음이 된다.
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { IMPROVEMENT_META, dtype } from "@/theme";
import { classifyImprovement, improvementSummary } from "@/lib/improvement";

interface Props {
  decision?: unknown;
  title?: string | null;
  tags?: string[] | null;
  /** 예상 읽기 시간(분). 태그가 없어도 이것만 있으면 보여준다. */
  readMinutes?: number | null;
  /** 상세 화면용 — 태그 아래 "~로 ~을 개선한 사례" 한 줄까지. */
  withSummary?: boolean;
}

export function ImprovementTag({
  decision,
  title,
  tags,
  readMinutes,
  withSummary = false,
}: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  const type = classifyImprovement({ decision, title, tags });
  const meta = type ? IMPROVEMENT_META[type] : null;
  const mins = readMinutes && readMinutes > 0 ? `${readMinutes}분` : null;
  const summary = withSummary ? improvementSummary(decision, type) : null;

  if (!meta && !mins) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {meta ? (
          <View style={[styles.chip, { backgroundColor: meta.tint }]}>
            <Text style={styles.emoji}>{meta.emoji}</Text>
            <Text style={[styles.text, { color: meta.color }]} numberOfLines={1}>
              {meta.label}
            </Text>
          </View>
        ) : null}
        {mins ? (
          <Text style={[styles.mins, { color: c.textMuted }]}>{meta ? `· ${mins}` : mins}</Text>
        ) : null}
      </View>
      {summary ? (
        <Text style={[styles.summary, { color: c.textSecondary }]} numberOfLines={2}>
          {summary}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  emoji: { fontSize: 11 },
  text: { ...dtype.label, fontSize: 11.5 },
  mins: { ...dtype.meta },
  summary: { ...dtype.bodyS, fontSize: 13, lineHeight: 19 },
});
