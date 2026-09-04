// "무엇을 개선한 사례인가" 태그 + 읽기 시간 — **글 상세**의 태그 줄에 쓴다.
//
// 난이도가 "용어가 나오는가"만 말하는 데 비해, 이 태그는 "어떤 문제를 어떻게
// 풀었나"를 말한다. 기획자·디자이너·마케터가 고를 근거가 되는 축이다.
//
// ⚠️ 분류 신호가 없으면 태그를 안 그린다. 억지로 붙이면 다시 소음이 된다.
// ⚠️ 유형별 파스텔을 뺐다. 상세 상단엔 이미 주제 칩이 색을 갖고 있어서,
//    같은 팔레트를 한 번 더 쓰면 어느 색이 무슨 뜻인지 알 수 없어진다.
//    유형 구분은 **lucide 아이콘**이 맡고 색은 주제 칩에 양보한다.
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
  const Icon = meta?.icon;

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {meta && Icon ? (
          <View style={[styles.chip, { backgroundColor: c.surfaceSunken }]}>
            <Icon size={13} color={c.textSecondary} strokeWidth={2} />
            <Text style={[styles.text, { color: c.textSecondary }]} numberOfLines={1}>
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
  // 주제 칩과 같은 규격(pill · paddingH 8 · dtype.label).
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
  },
  text: { ...dtype.label },
  mins: { ...dtype.meta },
  summary: { ...dtype.bodyS },
});
