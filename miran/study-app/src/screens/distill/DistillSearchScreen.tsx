// distill 검색 탭 (회의록 §검색) — 검색 전: 최근 검색어 · 추천 검색어 · 급상승 검색어 / 검색 후: 결과.
import React, { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Clock, Search, Sparkles, TrendingUp, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useArticlesFeed, usePopularTags, useRecommendedKeywords } from "@/data";
import { useRecentSearches } from "@/lib/recentSearches";
import { dtype } from "@/theme";
import { ArticleRow } from "@/components/distill/ArticleCards";
import { Loading, ErrorState, EmptyState } from "@/components";

export function DistillSearchScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [query, setQuery] = useState("");
  const { recents, add, remove, clear } = useRecentSearches();
  const recommended = useRecommendedKeywords(10);
  const popular = usePopularTags();

  const q = query.trim();
  const active = q.length > 0;
  const feed = useArticlesFeed(active ? { search: q } : {});
  const rows = feed.data?.pages.flatMap((p) => p.rows) ?? [];

  const runSearch = (term: string) => {
    setQuery(term);
    add(term);
  };

  const rec = recommended.data ?? [];
  const trending = (popular.data ?? []).slice(0, 10);

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
        <ScrollView contentContainerStyle={styles.preContent} keyboardShouldPersistTaps="handled">
          {/* 최근 검색어 */}
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

          {/* 추천 검색어 — 내가 읽은 글 기반 */}
          <View style={styles.section}>
            <View style={styles.sectionLabelRow}>
              <Sparkles size={14} color={c.textSecondary} />
              <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>추천 검색어</Text>
            </View>
            {rec.length > 0 ? (
              <View style={styles.chipWrap}>
                {rec.map((t) => (
                  <Pressable
                    key={t}
                    style={[styles.recChip, { borderColor: c.hairline }]}
                    onPress={() => runSearch(t)}
                  >
                    <Text style={[styles.recText, { color: c.textPrimary }]}>{t} 찾아볼까요?</Text>
                  </Pressable>
                ))}
              </View>
            ) : (
              <Text style={[styles.hint, { color: c.textMuted }]}>
                글을 읽고 독후감을 남기면 관심사에 맞는 추천이 생겨요.
              </Text>
            )}
          </View>

          {/* 급상승 검색어 Top 10 */}
          {trending.length > 0 ? (
            <View style={styles.section}>
              <View style={styles.sectionLabelRow}>
                <TrendingUp size={14} color={c.textSecondary} />
                <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>급상승 검색어</Text>
              </View>
              <View style={styles.rankList}>
                {trending.map((t, i) => (
                  <Pressable key={t} style={styles.rankRow} onPress={() => runSearch(t)}>
                    <Text style={[styles.rankNum, { color: i < 3 ? c.primary : c.textMuted }]}>
                      {i + 1}
                    </Text>
                    <Text style={[styles.rankText, { color: c.textPrimary }]}>{t}</Text>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : feed.isLoading ? (
        <Loading label="검색 중…" />
      ) : feed.isError ? (
        <ErrorState onRetry={() => feed.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="결과가 없어요" hint="다른 검색어를 시도해보세요" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <ArticleRow article={item} onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })} />
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

  preContent: { padding: 16, gap: 26 },
  section: { gap: 12 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sectionLabelRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  sectionLabel: { ...dtype.title },
  clearAll: { ...dtype.meta },
  hint: { ...dtype.bodyS, lineHeight: 20 },

  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  recentChip: { flexDirection: "row", alignItems: "center", gap: 7, borderWidth: 1, borderRadius: 999, paddingLeft: 14, paddingRight: 10, paddingVertical: 8 },
  recentText: { ...dtype.label, fontSize: 13.5 },
  recChip: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 9 },
  recText: { ...dtype.label, fontSize: 13.5 },

  rankList: { gap: 2 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 9 },
  rankNum: { ...dtype.cardTitle, width: 20 },
  rankText: { ...dtype.body, flex: 1 },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sep: { height: 1 },
});
