// 컬리/무신사식 필터 — 드롭다운 칩 바 + 바텀시트(탭: 기업/주제/정렬) 선택. (DESIGN_SYSTEM §4.2/§4.5)
//   칩 클릭 → 하단 시트가 해당 탭으로 열림 → 체크(다중) 선택 → "N개 글 보기"로 적용.
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, ChevronDown, RotateCcw } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { TOPIC_META, TOPIC_ORDER } from "@/theme";
import type { BlogRow } from "@/types/tables";
import type { Topic } from "@/types/database";
import { useArticlesFeedCount } from "@/data";
import { ServiceLogo } from "@/components/distill/ArticleCards";

export type FeedSort = "latest" | "popular";
type Tab = "blog" | "topic" | "sort";

export interface FilterValue {
  blogs: Set<string>;
  topics: Set<Topic>;
  sort: FeedSort;
}

export function FilterSheet({
  blogs,
  value,
  onChange,
}: {
  blogs: BlogRow[];
  value: FilterValue;
  onChange: (v: FilterValue) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>("blog");
  // 시트 안 임시 선택(적용 눌러야 반영).
  const [draft, setDraft] = useState<FilterValue>(value);

  const blogLabel =
    value.blogs.size === 0 ? "기업" : `기업 ${value.blogs.size}`;
  const topicLabel =
    value.topics.size === 0 ? "카테고리" : `카테고리 ${value.topics.size}`;
  const sortLabel = value.sort === "latest" ? "최신순" : "인기순";

  const openAt = (t: Tab) => {
    setDraft({ blogs: new Set(value.blogs), topics: new Set(value.topics), sort: value.sort });
    setTab(t);
    setOpen(true);
  };
  const apply = () => {
    onChange({ blogs: new Set(draft.blogs), topics: new Set(draft.topics), sort: draft.sort });
    setOpen(false);
  };
  const reset = () => setDraft({ blogs: new Set(), topics: new Set(), sort: "latest" });

  const toggleBlog = (id: string) =>
    setDraft((p) => {
      const n = new Set(p.blogs);
      n.has(id) ? n.delete(id) : n.add(id);
      return { ...p, blogs: n };
    });
  const toggleTopic = (t: Topic) =>
    setDraft((p) => {
      const n = new Set(p.topics);
      n.has(t) ? n.delete(t) : n.add(t);
      return { ...p, topics: n };
    });

  // 시트의 "N개 글 보기" 실시간 개수(임시 선택 기준).
  const draftFilter = useMemo(
    () => ({
      ...(draft.topics.size > 0 ? { topics: [...draft.topics] } : {}),
      ...(draft.blogs.size > 0 ? { blogIds: [...draft.blogs] } : {}),
    }),
    [draft.blogs, draft.topics],
  );
  const draftCount = useArticlesFeedCount(draftFilter).data;

  return (
    <>
      {/* 드롭다운 칩 바 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipBar}>
        <FilterChip label={blogLabel} active={value.blogs.size > 0} onPress={() => openAt("blog")} />
        <FilterChip label={topicLabel} active={value.topics.size > 0} onPress={() => openAt("topic")} />
        <FilterChip label={sortLabel} active={value.sort !== "latest"} onPress={() => openAt("sort")} />
      </ScrollView>

      {/* 필터 바텀시트 */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.surfaceCard }]} onPress={() => {}}>
            <View style={styles.grip}>
              <View style={[styles.gripBar, { backgroundColor: c.hairline }]} />
            </View>
            <Text style={[styles.sheetTitle, { color: c.textPrimary }]}>필터</Text>

            {/* 탭 */}
            <View style={[styles.tabs, { borderBottomColor: c.hairline }]}>
              {(["blog", "topic", "sort"] as const).map((t) => {
                const on = tab === t;
                const label = t === "blog" ? "기업" : t === "topic" ? "카테고리" : "정렬";
                return (
                  <Pressable key={t} style={styles.tab} onPress={() => setTab(t)}>
                    <Text style={[styles.tabText, { color: on ? c.primary : c.textMuted }]}>{label}</Text>
                    {on ? <View style={[styles.tabBar, { backgroundColor: c.primary }]} /> : null}
                  </Pressable>
                );
              })}
            </View>

            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {tab === "blog" &&
                blogs.map((b) => (
                  <CheckRow
                    key={b.id}
                    label={b.name}
                    checked={draft.blogs.has(b.id)}
                    onPress={() => toggleBlog(b.id)}
                    left={<ServiceLogo name={b.name} brandColor={b.brand_color} homepage={b.homepage} blogKey={b.key} size={24} />}
                  />
                ))}
              {tab === "topic" &&
                TOPIC_ORDER.map((t) => (
                  <CheckRow key={t} label={TOPIC_META[t].label} checked={draft.topics.has(t)} onPress={() => toggleTopic(t)} />
                ))}
              {tab === "sort" &&
                (["latest", "popular"] as const).map((s) => (
                  <CheckRow
                    key={s}
                    label={s === "latest" ? "최신순" : "인기순"}
                    checked={draft.sort === s}
                    radio
                    onPress={() => setDraft((p) => ({ ...p, sort: s }))}
                  />
                ))}
            </ScrollView>

            {/* 하단: 초기화 + N개 글 보기 */}
            <View style={styles.footer}>
              <Pressable style={styles.resetBtn} onPress={reset} hitSlop={6}>
                <RotateCcw size={16} color={c.textMuted} />
                <Text style={[styles.resetText, { color: c.textMuted }]}>초기화</Text>
              </Pressable>
              <Pressable style={[styles.applyBtn, { backgroundColor: c.primary }]} onPress={apply}>
                <Text style={[styles.applyText, { color: c.actionOn }]}>
                  {draftCount != null ? `${draftCount.toLocaleString()}개 글 보기` : "글 보기"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? c.primaryTint : c.surfaceCard, borderColor: active ? c.primary : c.hairline },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? c.primary : c.textSecondary }]}>{label}</Text>
      <ChevronDown size={15} color={active ? c.primary : c.textMuted} />
    </Pressable>
  );
}

function CheckRow({
  label,
  checked,
  onPress,
  left,
  radio,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
  left?: React.ReactNode;
  radio?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      {left}
      <Text style={[styles.rowLabel, { color: c.textPrimary }]}>{label}</Text>
      <View
        style={[
          radio ? styles.radio : styles.box,
          checked ? { backgroundColor: c.primary, borderColor: c.primary } : { borderColor: c.hairline },
        ]}
      >
        {checked ? <Check size={14} color={c.actionOn} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chipBar: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 10,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: "700" },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 20 },
  grip: { alignItems: "center", paddingTop: 10 },
  gripBar: { width: 40, height: 4, borderRadius: 2 },
  sheetTitle: { fontSize: 18, lineHeight: 24, fontWeight: "800", paddingHorizontal: 20, paddingTop: 8 },

  tabs: { flexDirection: "row", borderBottomWidth: 1, marginTop: 12, paddingHorizontal: 8 },
  tab: { paddingHorizontal: 16, paddingVertical: 12 },
  tabText: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
  tabBar: { position: "absolute", bottom: -1, left: 12, right: 12, height: 2, borderRadius: 2 },

  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, paddingHorizontal: 20 },
  rowLabel: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: "500" },
  box: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },

  footer: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 20, paddingTop: 12 },
  resetBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 8 },
  resetText: { fontSize: 13, fontWeight: "600" },
  applyBtn: { flex: 1, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  applyText: { fontSize: 15, lineHeight: 20, fontWeight: "700" },
});
