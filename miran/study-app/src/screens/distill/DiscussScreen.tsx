// distill 토론 탭 — 사람들의 의견(핵심 인사이트) 모아보기 (DESIGN_GUIDE §7.2b).
//   필터/검색 강화: 정렬(최신·인기, 서버) · 주제 칩(클라) · 검색(의견·글·서비스, 클라).
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useOpinionsFeed, useBlogs, type OpinionSort } from "@/data";
import { dtype, TOPIC_META, TOPIC_ORDER } from "@/theme";
import type { Topic } from "@/types/database";
import { OpinionCard } from "@/components/distill/OpinionCard";
import { BlogDropdown } from "@/components/distill/BlogDropdown";
import { Loading, ErrorState, EmptyState } from "@/components";

export function DiscussScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();

  const [sort, setSort] = useState<OpinionSort>("latest");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [blogSel, setBlogSel] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  const blogsQ = useBlogs();
  const q = useOpinionsFeed(sort);
  const list = q.data ?? [];

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return list.filter((o) => {
      if (topic && o.article?.topic !== topic) return false;
      if (blogSel.size > 0 && !blogSel.has(o.article?.blog?.id ?? "")) return false;
      if (needle) {
        const hay = [JSON.stringify(o.insight), o.article?.title, o.article?.blog?.name, o.author?.name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [list, topic, blogSel, query]);

  const filtering = topic !== null || blogSel.size > 0 || query.trim().length > 0;
  const countLabel = `${filtered.length.toLocaleString()}개`;

  const toggleBlog = (id: string) =>
    setBlogSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      <View style={styles.header}>
        <View>
          <Text style={[styles.title, { color: c.textPrimary }]}>토론</Text>
          <Text style={[styles.sub, { color: c.textMuted }]}>독후감·인사이트 모아보기</Text>
        </View>
      </View>

      {/* 검색 */}
      <View style={styles.searchWrap}>
        <View style={[styles.search, { backgroundColor: c.surfaceSunken, borderColor: c.hairline }]}>
          <Search size={16} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="의견 · 글 · 서비스 검색"
            placeholderTextColor={c.textMuted}
            style={[styles.searchInput, { color: c.textPrimary }]}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <X size={16} color={c.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {/* 최상단 기업 드롭다운(피드와 동일) */}
      <BlogDropdown
        blogs={blogsQ.data ?? []}
        selected={blogSel}
        onToggle={toggleBlog}
        onClear={() => setBlogSel(new Set())}
      />

      {/* 주제 칩 */}
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          <Chip label="전체" active={topic === null} onPress={() => setTopic(null)} />
          {TOPIC_ORDER.map((t) => (
            <Chip
              key={t}
              label={TOPIC_META[t].label}
              active={topic === t}
              onPress={() => setTopic(topic === t ? null : t)}
            />
          ))}
        </ScrollView>
      </View>

      {/* 의견 개수(좌) + 정렬(우) — 피드와 동일 */}
      <View style={styles.filterRow}>
        <Text style={[styles.countText, { color: c.textSecondary }]}>{countLabel}</Text>
        <View style={[styles.sortSeg, { backgroundColor: c.surfaceSunken }]}>
          {(["latest", "popular"] as const).map((s) => {
            const on = sort === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSort(s)}
                style={[styles.sortBtn, on && { backgroundColor: c.surfaceCard }]}
              >
                <Text style={[styles.sortBtnText, { color: on ? c.primary : c.textMuted }]}>
                  {s === "latest" ? "최신순" : "인기순"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {q.isLoading ? (
        <Loading label="불러오는 중…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="아직 의견이 없어요" hint="글을 읽고 첫 의견을 남겨보세요" />
      ) : filtered.length === 0 ? (
        <EmptyState
          title="조건에 맞는 의견이 없어요"
          hint={filtering ? "다른 주제·검색어로 찾아보세요" : "글을 읽고 첫 의견을 남겨보세요"}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => (
            <OpinionCard
              opinion={item}
              onPress={() => nav.navigate("OpinionDetail", { opinionId: item.id })}
              onAuthorPress={
                item.author_id
                  ? () => nav.navigate("InsighterProfile", { userId: item.author_id! })
                  : undefined
              }
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          keyboardDismissMode="on-drag"
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
        />
      )}
    </SafeAreaView>
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
        { backgroundColor: active ? c.primary : c.surfaceSunken, borderColor: active ? c.primary : c.hairline },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? c.actionOn : c.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { ...dtype.display },
  sub: { ...dtype.bodyS, marginTop: 2 },
  sortSeg: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  sortBtnText: { ...dtype.label, fontSize: 12.5, fontWeight: "700" },

  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
  },
  countText: { ...dtype.label, fontSize: 13, fontWeight: "700" },

  searchWrap: { paddingHorizontal: 16, paddingTop: 4 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, ...dtype.body, padding: 0 },

  chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { ...dtype.label, fontSize: 13 },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
});
