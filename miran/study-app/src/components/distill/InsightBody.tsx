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
  /** core·apply 를 쓸 때 화면에 떴던 질문 전문(옛 데이터엔 없다). */
  coreQ?: string;
  applyQ?: string;
}

const FIELDS: { key: keyof InsightData; label: string; qKey?: keyof InsightData }[] = [
  { key: "core", label: "핵심 인사이트", qKey: "coreQ" }, // ① 질문에 답한 것
  { key: "apply", label: "우리 일엔 이렇게", qKey: "applyQ" }, // ② 질문에 답한 것
  { key: "quote", label: "인상적인 문장" },
  { key: "interpretation", label: "밑줄에 남긴 메모" },
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
      {fields.map((f) => {
        // 답과 **짝이 되는 질문 전문**. 질문 없이 답만 있으면 무슨 말인지 모른다.
        //   ⚠️ 질문은 줄임표로 자르지 않는다(numberOfLines 없음). 예전엔 답과 한 덩어리로
        //      이어붙여 저장해서 카드에서 질문이 반토막 났다.
        const q = f.qKey ? (insight[f.qKey] as string | undefined) : undefined;
        return (
          <View key={f.key} style={styles.field}>
            <Text style={[styles.label, { color: c.primary }]}>{f.label}</Text>
            {q ? (
              <Text style={[styles.question, { color: c.textSecondary }]}>Q. {q}</Text>
            ) : null}
            <Text
              style={[styles.value, { color: c.textPrimary }]}
              numberOfLines={compact ? PREVIEW_LINES : undefined}
            >
              {q ? "→ " : ""}
              {insight[f.key] as string}
            </Text>
          </View>
        );
      })}
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
  // 질문은 답보다 한 톤 작고 흐리게 — 주인공은 답이다. 다만 **자르지는 않는다.**
  question: { ...dtype.bodyS, lineHeight: 20 },
  value: { ...dtype.body, lineHeight: 23 },
  more: { ...dtype.meta, marginTop: 2 },
});
