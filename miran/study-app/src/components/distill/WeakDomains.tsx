// "자주 막히는 영역" — 단어장을 학습 지도로 바꾸는 화면 조각.
//
// 단어를 누른 것 자체가 **"이 영역에 아직 약하다"는 신호**다. 이건 비개발자 전용 기능이
// 아니다: 개발자가 '리텐션 / 코호트 / LTV' 를 누르면 정확히 대칭으로 작동한다.
// 그래서 "모르는 단어 목록"이 아니라 "내가 지금 채우고 있는 영역"으로 보여준다.
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { WORD_DOMAIN_LABEL, dtype } from "@/theme";
import { useMyWeakDomains } from "@/data";

export function WeakDomains() {
  const { theme } = useTheme();
  const c = theme.colors;
  const q = useMyWeakDomains();

  const rows = (q.data ?? []).filter((r) => r.count > 0).slice(0, 4);
  if (rows.length === 0) return null;

  const max = Math.max(...rows.map((r) => r.count));

  return (
    <View style={[styles.card, { borderColor: c.hairline, backgroundColor: c.surfaceCard }]}>
      <Text style={[styles.title, { color: c.textPrimary }]}>자주 막히는 영역</Text>
      <Text style={[styles.hint, { color: c.textMuted }]}>
        글에서 눌러본 단어를 영역별로 모았어요
      </Text>
      <View style={styles.rows}>
        {rows.map((r) => (
          <View key={r.domain} style={styles.row}>
            <Text style={[styles.label, { color: c.textSecondary }]} numberOfLines={1}>
              {WORD_DOMAIN_LABEL[r.domain] ?? r.domain}
            </Text>
            <View style={[styles.track, { backgroundColor: c.surfaceSunken }]}>
              <View
                style={[
                  styles.fill,
                  { backgroundColor: c.primary, width: `${Math.round((r.count / max) * 100)}%` },
                ]}
              />
            </View>
            <Text style={[styles.count, { color: c.textMuted }]}>{r.count}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 16, marginTop: 12 },
  title: { ...dtype.cardTitle, fontSize: 15 },
  hint: { ...dtype.meta, marginTop: 2, marginBottom: 12 },
  rows: { gap: 10 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  label: { ...dtype.label, fontSize: 12.5, width: 56 },
  track: { flex: 1, height: 8, borderRadius: 999, overflow: "hidden" },
  fill: { height: 8, borderRadius: 999 },
  count: { ...dtype.meta, width: 22, textAlign: "right" },
});
