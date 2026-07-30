import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { toInsight } from "@/lib/insight";

/**
 * 공유 글의 "핵심 인사이트"(구조화 회고)를 상세화면에 표시.
 * insight 가 없으면(옛 글) fallbackText(자유 메모)를 평문으로 보여준다.
 */
export function InsightView({
  raw,
  fallbackText,
}: {
  raw: unknown;
  fallbackText?: string | null;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const ins = toInsight(raw);

  if (!ins.core) {
    if (!fallbackText || !fallbackText.trim()) return null;
    return (
      <View style={{ marginTop: 4 }}>
        {fallbackText
          .split("\n")
          .filter((l) => l.trim())
          .map((p, i) => (
            <Text key={i} style={[styles.plain, { color: c.textPrimary }]}>
              {p}
            </Text>
          ))}
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {/* 핵심 인사이트 */}
      <View style={[styles.core, { backgroundColor: c.tintLavender }]}>
        <Text style={[styles.coreLabel, { color: c.primary }]}>핵심 인사이트</Text>
        <Text style={[styles.coreText, { color: c.textPrimary }]}>{ins.core}</Text>
      </View>

      {ins.quote ? (
        <View style={[styles.quote, { borderLeftColor: c.primary }]}>
          <Text style={[styles.quoteText, { color: c.textSecondary }]}>“{ins.quote}”</Text>
        </View>
      ) : null}

      {ins.interpretation ? <Field label="인사이트 해석" body={ins.interpretation} /> : null}
      {ins.apply ? <Field label="바로 적용할 수 있는 것" body={ins.apply} /> : null}
      {ins.similar ? <Field label="비슷한 사례" body={ins.similar} /> : null}

      {ins.questions.length > 0 ? (
        <View style={styles.qBlock}>
          <Text style={[styles.fieldLabel, { color: c.primary }]}>함께 나눌 질문</Text>
          {ins.questions.map((q, i) => (
            <View key={i} style={styles.qItem}>
              <Text style={[styles.qNum, { color: c.primary }]}>Q{i + 1}</Text>
              <Text style={[styles.qText, { color: c.textPrimary }]}>{q}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function Field({ label, body }: { label: string; body: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: c.primary }]}>{label}</Text>
      <Text style={[styles.fieldBody, { color: c.textPrimary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12, marginTop: 8 },
  plain: { fontSize: 15, lineHeight: 22, marginTop: 3 },
  core: { borderRadius: 10, padding: 12, gap: 4 },
  coreLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  coreText: { fontSize: 15.5, lineHeight: 24, fontWeight: "600" },
  quote: { borderLeftWidth: 3, paddingLeft: 10, paddingVertical: 2 },
  quoteText: { fontSize: 14, lineHeight: 21, fontStyle: "italic" },
  field: { gap: 3 },
  fieldLabel: { fontSize: 12.5, fontWeight: "700" },
  fieldBody: { fontSize: 14.5, lineHeight: 22 },
  qBlock: { gap: 7 },
  qItem: { flexDirection: "row", gap: 8 },
  qNum: { fontSize: 13, fontWeight: "800", width: 26 },
  qText: { flex: 1, fontSize: 14.5, lineHeight: 21 },
});
