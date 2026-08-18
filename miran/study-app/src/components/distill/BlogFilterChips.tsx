// 기업 필터 가로 칩 — 피드·의견에서 공용(무신사식 최상단 카테고리 칩).
// [전체] + 각 기업(로고+이름). 다중선택 토글, '전체'는 선택 해제.
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype } from "@/theme";
import type { BlogRow } from "@/types/tables";
import { ServiceLogo } from "@/components/distill/ArticleCards";

export function BlogFilterChips({
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
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      <Pressable
        onPress={onClear}
        style={[
          styles.chip,
          styles.allChip,
          {
            backgroundColor: selected.size === 0 ? c.primary : c.surfaceCard,
            borderColor: selected.size === 0 ? c.primary : c.hairline,
          },
        ]}
      >
        <Text style={[styles.chipText, { color: selected.size === 0 ? c.actionOn : c.textSecondary }]}>
          전체
        </Text>
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
  row: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 6,
  },
  allChip: { paddingLeft: 16 },
  chipText: { ...dtype.label, fontSize: 13 },
});
