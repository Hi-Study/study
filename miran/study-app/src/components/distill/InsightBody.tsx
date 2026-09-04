// 인사이트(감상문) 구조화 표시 — 각 항목을 [타이틀 + 내용] 블록으로 보여준다.
//
// ⚠️ **순서는 쓴 순서 그대로다.** 쓰기 화면은
//      ① 이 글에서 무엇을 보셨나요(→ core)
//      ② 그래서 우리 일엔 어떻게 쓸까요(→ apply)
//      ③ 질문·토론(→ questions)
//    이고 밑줄(quote·메모)은 자동으로 붙는다. 그런데 보기 화면이 핵심 → 문장 → 해석 →
//    접목 순이라, 쓴 사람이 자기 글을 보고 "내가 이 순서로 안 썼는데" 가 됐다.
//    읽는 순서 = 쓴 순서.
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
  { key: "core", label: "핵심 인사이트" }, // ① 질문에 답한 것
  { key: "apply", label: "우리 일엔 이렇게" }, // ② 질문에 답한 것
  { key: "quote", label: "인상적인 문장" }, // 밑줄에서 자동
  { key: "interpretation", label: "밑줄에 남긴 메모" }, // 밑줄에서 자동
  { key: "similar", label: "비슷한 사례" },
];

// 카드 미리보기(compact)에서 항목당 보여줄 최대 줄 수 / 질문 최대 개수.
const PREVIEW_LINES = 3;
const PREVIEW_QUESTIONS = 2;

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

  // 값이 있는 항목은 compact 여부와 무관하게 **전부** 타이틀+내용으로 보여준다.
  // compact(카드 미리보기)는 "항목을 줄이는" 게 아니라 "항목별 길이를 줄이는" 모드.
  const fields = FIELDS.filter(
    (f) => typeof insight[f.key] === "string" && (insight[f.key] as string).trim(),
  );
  const allQuestions = Array.isArray(insight.questions)
    ? insight.questions.filter((q) => q && q.trim())
    : [];
  const questions = compact ? allQuestions.slice(0, PREVIEW_QUESTIONS) : allQuestions;
  const moreQuestions = allQuestions.length - questions.length;

  return (
    <View style={styles.wrap}>
      {fields.map((f) => (
        <View key={f.key} style={styles.field}>
          <Text style={[styles.label, { color: c.primary }]}>{f.label}</Text>
          <Text
            style={[styles.value, { color: c.textPrimary }]}
            numberOfLines={compact ? PREVIEW_LINES : undefined}
          >
            {insight[f.key] as string}
          </Text>
        </View>
      ))}
      {questions.length > 0 ? (
        <View style={styles.field}>
          <Text style={[styles.label, { color: c.primary }]}>떠오른 질문</Text>
          {questions.map((qv, i) => (
            <Text
              key={i}
              style={[styles.value, { color: c.textPrimary }]}
              numberOfLines={compact ? PREVIEW_LINES : undefined}
            >
              · {qv}
            </Text>
          ))}
          {moreQuestions > 0 ? (
            <Text style={[styles.more, { color: c.textMuted }]}>+{moreQuestions}개 더</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  field: { gap: 5 },
  label: { ...dtype.label, fontSize: 12, letterSpacing: 0.2, lineHeight: 17 },
  value: { ...dtype.body, lineHeight: 23 },
  more: { ...dtype.meta, marginTop: 2 },
});
