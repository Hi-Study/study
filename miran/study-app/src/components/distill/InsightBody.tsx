// 인사이트(감상문) 구조화 표시 — 각 항목을 [타이틀 + 내용] 블록으로 보여준다.
// (내용만 쭈르륵 X → 핵심/인상적인 문장/해석/접목/비슷한 사례/질문을 라벨과 함께.)
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype } from "@/theme";

export interface InsightData {
  core?: string;
  quote?: string;
  interpretation?: string;
  apply?: string;
  similar?: string;
  questions?: string[];
}

const FIELDS: { key: keyof InsightData; label: string }[] = [
  { key: "core", label: "핵심 인사이트" },
  { key: "quote", label: "인상적인 문장" },
  { key: "interpretation", label: "내 해석" },
  { key: "apply", label: "접목하고 싶은 방법" },
  { key: "similar", label: "비슷한 사례" },
];

export function InsightBody({
  insight,
  compact = false,
}: {
  insight: InsightData | null | undefined;
  compact?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  if (!insight) return null;

  // compact: 카드 미리보기 — 핵심만(라벨 포함). 전체: 값이 있는 모든 항목.
  const fields = (compact ? FIELDS.slice(0, 1) : FIELDS).filter(
    (f) => typeof insight[f.key] === "string" && (insight[f.key] as string).trim(),
  );
  const questions = Array.isArray(insight.questions)
    ? insight.questions.filter((q) => q && q.trim())
    : [];

  return (
    <View style={styles.wrap}>
      {fields.map((f) => (
        <View key={f.key} style={styles.field}>
          <Text style={[styles.label, { color: c.primary }]}>{f.label}</Text>
          <Text
            style={[styles.value, { color: c.textPrimary }]}
            numberOfLines={compact ? 4 : undefined}
          >
            {insight[f.key] as string}
          </Text>
        </View>
      ))}
      {!compact && questions.length > 0 ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: c.primary }]}>떠오른 질문</Text>
          {questions.map((qv, i) => (
            <Text key={i} style={[styles.value, { color: c.textPrimary }]}>
              · {qv}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  field: { gap: 5 },
  label: { ...dtype.label, fontSize: 12, letterSpacing: 0.2, lineHeight: 16 },
  value: { ...dtype.body, lineHeight: 23 },
});
