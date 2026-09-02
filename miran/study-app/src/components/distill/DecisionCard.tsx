// 결정 카드 — "어떤 테크를 썼나"가 아니라 **"어떤 문제를 어떻게 풀었나"**.
//
// 기획자·디자이너·마케터가 기술블로그에서 실제로 얻고 싶은 건 구현 방법이 아니라
// 대기업이 시행착오 끝에 내린 **판단**이다: 무슨 문제였고, 어떤 제약이 있었고,
// 뭘 골랐고, 뭘 버렸고, 결과가 어땠는지.
//
// ⚠️ 값이 없으면 카드를 통째로 숨긴다. 반쪽짜리 카드를 억지로 띄우지 않는다.
//    (회고·문화·인터뷰 글은 애초에 트레이드오프 서술이 없어 decision 이 null 이다.)
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype } from "@/theme";
import { decisionRows, hasDecision } from "@/lib/decision";

interface Props {
  decision: unknown;
}

export function DecisionCard({ decision }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (!hasDecision(decision)) return null;
  const rows = decisionRows(decision);

  return (
    <View style={[styles.card, { backgroundColor: c.surfacePageAlt, borderColor: c.accentTintBorder }]}>
      <Text style={[styles.head, { color: c.primary }]}>이 팀이 내린 결정</Text>
      <View style={styles.rows}>
        {rows.map((r) => (
          <View key={r.label} style={styles.row}>
            <Text style={[styles.label, { color: c.textMuted }]}>{r.label}</Text>
            <Text style={[styles.value, { color: c.textPrimary }]}>{r.value}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  head: { ...dtype.label, fontSize: 12.5, letterSpacing: 0.2 },
  rows: { gap: 10 },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  label: { ...dtype.label, fontSize: 12, width: 68, paddingTop: 2 },
  value: { ...dtype.body, flex: 1, lineHeight: 23 },
});
