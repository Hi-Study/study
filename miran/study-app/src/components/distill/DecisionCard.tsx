// 결정 카드 — **제목 아래 한 줄이 못 담는 것**만 담는다.
//
// 기획자·디자이너·마케터가 기술블로그에서 얻고 싶은 건 구현 방법이 아니라 대기업이
// 시행착오 끝에 내린 **판단**이다: 무슨 문제였고, 어떤 제약이 있었고, 뭘 버렸고, 얼마나 나아졌나.
//
// ⚠️ **"선택한 방법"은 여기 없다.** 제목 바로 아래 한 줄이 이미 그 말을 한다
//    ("PRD 자동화로 사용자 경험을 개선한 사례"). 예전엔 카드가 그걸 다시 적어서
//    같은 내용이 두 번 나왔다 — 읽는 사람은 "이거 왜 또 있지?" 가 된다.
// ⚠️ 남길 게 하나도 없으면 카드를 통째로 숨긴다. 반쪽짜리 카드를 억지로 띄우지 않는다.
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
  if (rows.length === 0) return null; // 한 줄이 다 말한 글


  return (
    <View style={[styles.card, { backgroundColor: c.surfacePageAlt, borderColor: c.accentTintBorder }]}>
      <Text style={[styles.head, { color: c.primary }]}>이 결정의 배경</Text>
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
  head: { ...dtype.label, letterSpacing: 0.2 },
  rows: { gap: 10 },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  label: { ...dtype.label, width: 68, paddingTop: 2 },
  value: { ...dtype.body, flex: 1, lineHeight: 23 },
});
