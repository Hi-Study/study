import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { Sparkles } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { SUMMARY_MODES, type SummaryMap, type SummaryMode } from "@/lib/summary";

/** AI 요약 카드 — 원문요약/기획자관점/쉽게풀기 3개 모드 탭. 모드별로 따로 캐시·생성. */
export function AiSummary({
  title = "AI 요약",
  summaries,
  onGenerate,
  pending,
}: {
  title?: string;
  summaries: SummaryMap | null | undefined;
  onGenerate: (mode: SummaryMode) => void;
  pending: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [mode, setMode] = useState<SummaryMode>("plain");
  const [reqMode, setReqMode] = useState<SummaryMode | null>(null);

  const current = summaries?.[mode];
  const busy = pending && reqMode === mode;

  function gen(m: SummaryMode) {
    setReqMode(m);
    onGenerate(m);
  }

  return (
    <View style={[styles.box, { borderColor: c.hairline }]}>
      <View style={[styles.head, { backgroundColor: c.tintLavender }]}>
        <Sparkles size={14} color={c.primary} />
        <Text style={[styles.title, { color: c.primary }]}>{title}</Text>
      </View>

      {/* 모드 탭 */}
      <View style={[styles.tabs, { borderBottomColor: c.hairline }]}>
        {SUMMARY_MODES.map((m) => {
          const on = m.key === mode;
          return (
            <Pressable
              key={m.key}
              onPress={() => setMode(m.key)}
              style={[styles.tab, on && { borderBottomColor: c.primary }]}
            >
              <Text style={[styles.tabText, { color: on ? c.primary : c.textMuted }]}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 본문 */}
      <View style={styles.body}>
        {current ? (
          <>
            {current.split("\n").filter(Boolean).map((l, i) => (
              <Text key={i} style={[styles.line, { color: c.textPrimary }]}>
                {l}
              </Text>
            ))}
            <Pressable onPress={() => gen(mode)} disabled={busy} style={styles.regen} hitSlop={6}>
              <Text style={[styles.regenText, { color: c.textLink }]}>
                {busy ? "요약 중…" : "다시 요약"}
              </Text>
            </Pressable>
          </>
        ) : busy ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={c.primary} />
            <Text style={[styles.hint, { color: c.textMuted }]}>요약 중…</Text>
          </View>
        ) : (
          <Pressable onPress={() => gen(mode)} style={[styles.genBtn, { backgroundColor: c.primary }]}>
            <Text style={styles.genText}>요약하기</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { marginTop: 10, borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  head: { flexDirection: "row", alignItems: "center", gap: 7, padding: 10 },
  title: { fontSize: 13, fontWeight: "700" },
  tabs: { flexDirection: "row", borderBottomWidth: 1 },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 9,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabText: { fontSize: 12.5, fontWeight: "700" },
  body: { padding: 12 },
  line: { fontSize: 13.5, lineHeight: 21, marginTop: 4 },
  center: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 },
  hint: { fontSize: 12.5 },
  regen: { marginTop: 10, alignSelf: "flex-start" },
  regenText: { fontSize: 12.5, fontWeight: "700" },
  genBtn: { alignSelf: "flex-start", borderRadius: 90, paddingVertical: 7, paddingHorizontal: 14 },
  genText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
});
