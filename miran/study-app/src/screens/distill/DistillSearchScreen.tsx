// distill 검색 탭 (회의록 §검색) — 검색 전: 최근 검색어 · 추천 검색어 · 급상승 검색어 / 검색 후: 결과.
//   검색 결과에는 피드와 같은 필터를 붙인다. 단 기업도 카테고리와 **동일한 칩 디자인**(variant="chips").
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, Clock, Search, Sparkles, TrendingUp, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRoute, type RouteProp } from "@react-navigation/native";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import {
  useArticlesFeed,
  useArticlesFeedCount,
  useBlogs,
  usePopularTags,
  useRecommendedKeywords,
  useTrendingSearches,
  useLogSearch,
} from "@/data";
import { useRecentSearches } from "@/lib/recentSearches";
import { dtype } from "@/theme";
import { ArticleRow } from "@/components/distill/ArticleCards";
import { FilterSheet, emptyFilter, type FilterValue } from "@/components/distill/FilterSheet";
import { Loading, ErrorState, EmptyState } from "@/components";

export function DistillSearchScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const route = useRoute<RouteProp<RootStackParamList, "Search">>();
  const [query, setQuery] = useState(route.params?.q ?? "");
  const { recents, add, remove, clear } = useRecentSearches();
  const recommended = useRecommendedKeywords(10);
  const popular = usePopularTags();
  const trendingQ = useTrendingSearches(10);
  const logSearch = useLogSearch();

  // 결과 필터(기업·카테고리·정렬) — 피드와 동일한 컴포넌트, 칩 형태.
  const [filter, setFilter] = useState<FilterValue>(emptyFilter);
  const blogsQ = useBlogs();

  const q = query.trim();
  const active = q.length > 0;
  const baseFilter = useMemo(
    () => ({
      search: q,
      ...(filter.topics.size > 0 ? { topics: [...filter.topics] } : {}),
      ...(filter.blogIds.size > 0 ? { blogIds: [...filter.blogIds] } : {}),
    }),
    [q, filter.topics, filter.blogIds],
  );
  const feed = useArticlesFeed(active ? { ...baseFilter, sort: filter.sort } : {});
  const countQ = useArticlesFeedCount(active ? baseFilter : {});
  const rows = feed.data?.pages.flatMap((p) => p.rows) ?? [];

  const submit = (term: string) => {
    const t = term.trim();
    if (t.length < 2) return;
    add(t);
    logSearch.mutate(t); // 실제 급상승 집계용 로깅
  };
  const runSearch = (term: string) => {
    setQuery(term);
    submit(term);
  };

  const rec = recommended.data ?? [];
  // 실제 급상승(검색 로그 기반) — 아직 로그가 없으면 인기 키워드로 대체.
  const trending = (trendingQ.data?.length ? trendingQ.data : popular.data ?? []).slice(0, 10);

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      {/* 검색바 (상단 유틸에서 진입 — 뒤로가기) */}
      <View style={styles.searchWrap}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.backBtn}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <View style={[styles.searchBar, { backgroundColor: c.surfaceSunken, flex: 1 }]}>
          <Search size={18} color={c.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={() => submit(q)}
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
          {/* 최근 검색어 — 항상 노출(비어 있으면 안내) */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <View style={styles.sectionLabelRow}>
                <Clock size={14} color={c.textSecondary} />
                <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>최근 검색어</Text>
              </View>
              {recents.length > 0 ? (
                <Pressable onPress={clear} hitSlop={8}>
                  <Text style={[styles.clearAll, { color: c.textMuted }]}>전체삭제</Text>
                </Pressable>
              ) : null}
            </View>
            {recents.length > 0 ? (
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
            ) : (
              <Text style={[styles.hint, { color: c.textMuted }]}>
                최근 검색한 키워드가 여기에 표시돼요.
              </Text>
            )}
          </View>

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
              {/* 2열 × 5행 랭킹(왼쪽 1~5, 오른쪽 6~10) */}
              <View style={styles.rankGrid}>
                {[trending.slice(0, 5), trending.slice(5, 10)].map((col, ci) => (
                  <View key={ci} style={styles.rankCol}>
                    {col.map((t, i) => {
                      const rank = ci * 5 + i + 1;
                      return (
                        <Pressable key={t} style={styles.rankRow} onPress={() => runSearch(t)}>
                          <Text style={[styles.rankNum, { color: rank <= 3 ? c.primary : c.textMuted }]}>
                            {rank}
                          </Text>
                          <Text
                            style={[styles.rankText, { color: c.textPrimary }]}
                            numberOfLines={1}
                          >
                            {t}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </ScrollView>
      ) : (
        <>
          {/* 결과 필터 — [기업 ▾] [카테고리 ▾] [정렬 ▾] (전부 같은 칩 디자인) */}
          <FilterSheet
            blogs={blogsQ.data ?? []}
            value={filter}
            onChange={setFilter}
            variant="chips"
          />
          <View style={styles.countRow}>
            <Text style={[styles.countText, { color: c.textSecondary }]}>
              {countQ.data != null ? `${countQ.data.toLocaleString()}개` : ""}
            </Text>
          </View>

          {feed.isLoading ? (
            <Loading label="검색 중…" />
          ) : feed.isError ? (
            <ErrorState onRetry={() => feed.refetch()} />
          ) : rows.length === 0 ? (
            <EmptyState title="결과가 없어요" hint="검색어나 필터를 바꿔보세요" />
          ) : (
            <FlatList
              data={rows}
              keyExtractor={(a) => a.id}
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
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingRight: 16, paddingTop: 8, paddingBottom: 8 },
  backBtn: { width: 36, height: 44, alignItems: "center", justifyContent: "center" },
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

  rankGrid: { flexDirection: "row", gap: 18 },
  rankCol: { flex: 1, gap: 2 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 9 },
  rankNum: { ...dtype.cardTitle, width: 18 },
  rankText: { ...dtype.body, flex: 1 },

  countRow: { paddingHorizontal: 16, paddingTop: 2, paddingBottom: 8 },
  countText: { ...dtype.label, fontSize: 13 },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sep: { height: 1 },
});
