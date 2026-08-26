// 기업 필터 칩 바 — 라이프ON식 "전체 + 카테고리" 가로 스크롤 칩. (DESIGN_SYSTEM.md §4.2)
// 맨 앞 '전체'(선택 없을 때 채워짐) + 기업 칩(작은 파비콘 + 이름). 다중선택 토글.
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import type { BlogRow } from "@/types/tables";
import { ServiceLogo } from "@/components/distill/ArticleCards";

export function BlogChipsBar({
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
  const allOn = selected.size === 0;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
      <Pressable
        onPress={onClear}
        style={[
          styles.chip,
          styles.allChip,
          { backgroundColor: allOn ? c.primary : c.surfaceCard, borderColor: allOn ? c.primary : c.hairline },
        ]}
      >
        <Text style={[styles.chipText, { color: allOn ? c.actionOn : c.textSecondary }]}>전체</Text>
      </Pressable>
      {blogs.map((b) => {
        const on = selected.has(b.id);
        return (
          <Pressable
            key={b.id}
            onPress={() => onToggle(b.id)}
            style={[
              styles.chip,
              { backgroundColor: on ? c.primaryTint : c.surfaceCard, borderColor: on ? c.primary : c.hairline },
            ]}
          >
            <ServiceLogo name={b.name} brandColor={b.brand_color} homepage={b.homepage} blogKey={b.key} size={18} />
            <Text style={[styles.chipText, { color: on ? c.primary : c.textSecondary }]}>{b.name}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: "center" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 7,
  },
  allChip: { paddingLeft: 16 },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: "700" },
});
