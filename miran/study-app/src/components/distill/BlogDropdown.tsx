// 기업 필터 드롭다운 — 피드·의견 공용. 트리거 바를 누르면 위에서 리스트가 펼쳐진다(무신사식).
//   기본 '전체', 여러 기업 다중선택. 바텀시트가 아니라 상단에서 내려오는 드롭다운 리스트.
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Building2, Check, ChevronDown, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype } from "@/theme";
import type { BlogRow } from "@/types/tables";
import { ServiceLogo } from "@/components/distill/ArticleCards";

export function BlogDropdown({
  blogs,
  selected,
  onToggle,
  onClear,
}: {
  blogs: BlogRow[];
  selected: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);

  const names = blogs.filter((b) => selected.has(b.id)).map((b) => b.name);
  const summary =
    names.length === 0 ? "전체" : names.length === 1 ? names[0] : `${names[0]} 외 ${names.length - 1}개`;

  return (
    <>
      {/* 트리거 바 */}
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.trigger,
          { backgroundColor: c.surfaceCard, borderColor: selected.size > 0 ? c.primary : c.hairline },
        ]}
      >
        <Building2 size={16} color={selected.size > 0 ? c.primary : c.textSecondary} />
        <Text style={[styles.triggerLabel, { color: c.textMuted }]}>기업</Text>
        <Text
          style={[styles.triggerValue, { color: selected.size > 0 ? c.primary : c.textPrimary }]}
          numberOfLines={1}
        >
          {summary}
        </Text>
        <ChevronDown size={18} color={c.textMuted} />
      </Pressable>

      {/* 위에서 내려오는 드롭다운 리스트 */}
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <SafeAreaView edges={["top"]} style={styles.safeTop}>
            <Pressable style={[styles.panel, { backgroundColor: c.surfaceCard }]} onPress={() => {}}>
              <View style={styles.panelHead}>
                <Text style={[styles.panelTitle, { color: c.textPrimary }]}>기업 선택</Text>
                <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                  <X size={20} color={c.textMuted} />
                </Pressable>
              </View>

              {/* 전체 */}
              <Pressable style={[styles.allRow, { borderColor: c.hairline }]} onPress={onClear}>
                <Text
                  style={[styles.allText, { color: selected.size === 0 ? c.primary : c.textPrimary }]}
                >
                  전체
                </Text>
                {selected.size === 0 ? <Check size={18} color={c.primary} /> : null}
              </Pressable>

              {/* 기업 2열 리스트 */}
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                <View style={styles.grid}>
                  {blogs.map((b) => {
                    const on = selected.has(b.id);
                    return (
                      <Pressable
                        key={b.id}
                        onPress={() => onToggle(b.id)}
                        style={[
                          styles.cell,
                          { backgroundColor: on ? c.primaryTint : "transparent", borderColor: on ? c.primary : c.hairline },
                        ]}
                      >
                        <ServiceLogo
                          name={b.name}
                          brandColor={b.brand_color}
                          homepage={b.homepage}
                          blogKey={b.key}
                          size={22}
                        />
                        <Text
                          style={[styles.cellText, { color: on ? c.primary : c.textPrimary }]}
                          numberOfLines={1}
                        >
                          {b.name}
                        </Text>
                        {on ? <Check size={16} color={c.primary} /> : null}
                      </Pressable>
                    );
                  })}
                </View>
              </ScrollView>

              <Pressable style={[styles.done, { backgroundColor: c.primary }]} onPress={() => setOpen(false)}>
                <Text style={[styles.doneText, { color: c.actionOn }]}>
                  {selected.size > 0 ? `${selected.size}개 기업 보기` : "전체 보기"}
                </Text>
              </Pressable>
            </Pressable>
          </SafeAreaView>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 6,
  },
  triggerLabel: { ...dtype.label, fontSize: 12.5 },
  triggerValue: { ...dtype.body, fontSize: 14, fontWeight: "700", flex: 1 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)" },
  safeTop: { flex: 0 },
  panel: {
    marginHorizontal: 10,
    borderBottomLeftRadius: 18,
    borderBottomRightRadius: 18,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    padding: 16,
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  panelHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  panelTitle: { ...dtype.title },

  allRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingBottom: 10,
  },
  allText: { ...dtype.cardTitle },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 4 },
  cell: {
    width: "48%",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
  },
  cellText: { fontSize: 13, lineHeight: 18, fontWeight: "700", flex: 1 },

  done: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  doneText: { ...dtype.cardTitle },
});
