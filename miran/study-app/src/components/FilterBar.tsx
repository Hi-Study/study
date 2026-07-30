import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { SearchField } from "./Fields";

export type DateKey = "all" | "week" | "month";

export interface Filters {
  search: string;
  dateKey: DateKey;
  tag: string | null;
}

export const EMPTY_FILTERS: Filters = { search: "", dateKey: "all", tag: null };

const DATE_OPTS: { k: DateKey; label: string }[] = [
  { k: "all", label: "전체 기간" },
  { k: "week", label: "이번 주" },
  { k: "month", label: "이번 달" },
];

/** 검색(제목+내용) + 날짜 범위 + 태그 필터 바. */
export function FilterBar({
  value,
  onChange,
  tags,
  placeholder = "제목 · 내용 검색",
  showDate = true,
  hideSearch = false,
}: {
  value: Filters;
  onChange: (f: Filters) => void;
  tags: string[];
  placeholder?: string;
  showDate?: boolean;
  /** 검색창을 숨기고 칩(날짜·태그)만 렌더 — 검색 탭에서 히어로 검색바를 따로 둘 때. */
  hideSearch?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const set = (patch: Partial<Filters>) => onChange({ ...value, ...patch });
  const showChips = showDate || tags.length > 0;

  return (
    <View style={styles.wrap}>
      {hideSearch ? null : (
        <SearchField value={value.search} onChangeText={(t) => set({ search: t })} placeholder={placeholder} />
      )}
      {showChips ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
          keyboardShouldPersistTaps="handled"
        >
          {showDate
            ? DATE_OPTS.map((o) => (
                <Chip
                  key={o.k}
                  label={o.label}
                  active={value.dateKey === o.k}
                  onPress={() => set({ dateKey: o.k })}
                />
              ))
            : null}
          {showDate && tags.length > 0 ? (
            <View style={[styles.divider, { backgroundColor: c.hairline }]} />
          ) : null}
          {tags.map((t) => (
            <Chip
              key={t}
              label={`#${t}`}
              active={value.tag === t}
              onPress={() => set({ tag: value.tag === t ? null : t })}
            />
          ))}
        </ScrollView>
      ) : null}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        {
          backgroundColor: active ? c.primary : c.surfaceCard,
          borderColor: active ? c.primary : c.hairline,
        },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? "#fff" : c.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  chips: { flexDirection: "row", alignItems: "center", gap: 7, paddingRight: 8 },
  chip: { borderWidth: 1, borderRadius: 90, paddingVertical: 6, paddingHorizontal: 13 },
  chipText: { fontSize: 12.5, fontWeight: "600" },
  divider: { width: 1, height: 20, marginHorizontal: 2 },
});
