// distill 검색 탭 (회의록 §검색) — 검색 전: 최근 검색어 · 인기 키워드 · 주제 둘러보기 / 검색 후: 결과.
import React, { useState } from "react";
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
import { Clock, Search, TrendingUp, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useArticlesFeed, usePopularTags } from "@/data";
import { useRecentSearches } from "@/lib/recentSearches";
import { dtype, TOPIC_META, TOPIC_ORDER } from "@/theme";
import type { Topic } from "@/types/database";
import { ArticleRow } from "@/components/distill/ArticleCards";
import { Loading, ErrorState, EmptyState } from "@/components";

export function DistillSearchScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [query, setQuery] = useState("");
  const [topic, setTopic] = useState<Topic | null>(null);
  const { recents, add, remove, clear } = useRecentSearches();
  const popular = usePopularTags();

  const q = query.trim();
  const active = q.length > 0 || topic !== null;
  const feed = useArticlesFeed(
    active ? { search: q || undefined, topic: topic ?? undefined } : {},
  );
  const rows = feed.data?.pages.flatMap((p) => p.rows) ?? [];

  const runSearch = (term: string) => {
    setQuery(term);
    add(term);
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      {/* 검색바 */}
      <View style={styles.searchWrap}>
        <View style={[styles.searchBar, { backgroundColor: c.surfaceSunken }]}>
          <Search size={18} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => q && add(q)}
            placeholder="글 제목·주제·태그 검색"
            placeholderTextColor={c.textMuted}
            style={[styles.searchInput, { color: c.textPrimary }]}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <Pressable onPress={() => setQuery("")} hitSlop={8}>
              <X size={18} color={c.textMuted} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {!active ? (
        // 검색 전 — 최근 검색어 · 인기 키워드 · 주제 둘러보기
        <ScrollView contentContainerStyle={styles.preContent} keyboardShouldPersistTaps="handled">
          {recents.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <View style={styles.sectionLabelRow}>
                  <Clock size={14} color={c.textSecondary} />
                  <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>최근 검색어</Text>
                </View>
                <Pressable onPress={clear} hitSlop={8}>
                  <Text style={[styles.clearAll, { color: c.textMuted }]}>전체삭제</Text>
                </Pressable>
              </View>
              <View style={styles.chipWrap}>
                {recents.map((t) => (
                  <View
                    key={t}
                    style={[styles.recentChip, { backgroundColor: c.surfaceSunken, borderColor: c.hairline }]}
                  >
                    <Pressable onPress={() => runSearch(t)} hitSlop={6}>
                      <Text style={[styles.recentText, { color: c.textPrimary }]}>{t}</Text>
                    </Pressable>
                    <Pressable onPress={() => remove(t)} hitSlop={6}>
                      <X size={13} color={c.textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          ) : null}

          {popular.data && popular.data.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionLabelRow}>
                <TrendingUp size={14} color={c.textSecondary} />
                <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>인기 키워드</Text>
              </View>
              <View style={styles.chipWrap}>
                {popular.data.map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.popularChip, { backgroundColor: c.primaryTint }]}
                    onPress={() => runSearch(t)}
                  >
                    <Text style={[styles.popularText, { color: c.primary }]}>#{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>주제로 둘러보기</Text>
            <View style={styles.grid}>
              {TOPIC_ORDER.map((item) => {
                const meta = TOPIC_META[item];
                return (
                  <Pressable
                    key={item}
                    style={[styles.topicCard, { backgroundColor: meta.tint }]}
                    onPress={() => setTopic(item)}
                  >
                    <Text style={[styles.topicCardText, { color: meta.color }]}>{meta.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>
      ) : feed.isLoading ? (
        <Loading label="검색 중…" />
      ) : feed.isError ? (
        <ErrorState onRetry={() => feed.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="결과가 없어요" hint="다른 검색어나 주제를 시도해보세요" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(a) => a.id}
          ListHeaderComponent={
            topic ? (
              <Pressable style={styles.filterChip} onPress={() => setTopic(null)}>
                <Text style={[styles.filterChipText, { color: c.primary }]}>
                  {TOPIC_META[topic].label} ✕
                </Text>
              </Pressable>
            ) : null
          }
          renderItem={({ item }) => (
            <ArticleRow
              article={item}
              onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })}
            />
          )}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: c.hairline }]} />}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 8 },
  searchBar: { flexDirection: "row", alignItems: "center", gap: 8, borderRadius: 12, paddingHorizontal: 12, height: 44 },
  searchInput: { flex: 1, ...dtype.body },

  preContent: { padding: 16, gap: 24 },
  section: { gap: 12 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionLabel: { ...dtype.title },
  clearAll: { ...dtype.meta },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  recentChip: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 999, paddingLeft: 14, paddingRight: 10, paddingVertical: 8 },
  recentText: { ...dtype.label, fontSize: 13.5 },
  popularChip: { borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  popularText: { ...dtype.label, fontSize: 13.5, fontWeight: "700" },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  topicCard: { width: "47%", flexGrow: 1, height: 84, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  topicCardText: { ...dtype.cardTitle, fontWeight: "700" },

  filterChip: { alignSelf: "flex-start", paddingVertical: 6, marginBottom: 4 },
  filterChipText: { ...dtype.label, fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sep: { height: 1 },
});
