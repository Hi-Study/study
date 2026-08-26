// distill 피드 탭 — 주제별 테크 글 스트림 (회의록 §피드).
// 컬리식 필터(드롭다운 칩 → 바텀시트 탭) + [개수 좌] + 글 리스트.
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useArticlesFeed, useArticlesFeedCount, useBlogs } from "@/data";
import { dtype } from "@/theme";
import type { Topic } from "@/types/database";
import { ArticleRow } from "@/components/distill/ArticleCards";
import { FilterSheet, type FilterValue } from "@/components/distill/FilterSheet";
import { Loading, ErrorState, EmptyState } from "@/components";

export function FeedScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [filter, setFilter] = useState<FilterValue>({
    blogs: new Set<string>(),
    topics: new Set<Topic>(),
    sort: "latest",
  });

  const blogsQ = useBlogs();
  const baseFilter = useMemo(
    () => ({
      ...(filter.topics.size > 0 ? { topics: [...filter.topics] } : {}),
      ...(filter.blogs.size > 0 ? { blogIds: [...filter.blogs] } : {}),
    }),
    [filter.topics, filter.blogs],
  );
  const q = useArticlesFeed({ ...baseFilter, sort: filter.sort });
  const countQ = useArticlesFeedCount(baseFilter);
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const countLabel = countQ.data != null ? `${countQ.data.toLocaleString()}개` : "";

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      {/* 제목 + 검색 유틸 */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.textPrimary }]}>피드</Text>
        <Pressable hitSlop={8} style={styles.searchUtil} onPress={() => nav.navigate("Search")}>
          <Search size={22} color={c.textSecondary} />
        </Pressable>
      </View>

      {/* 컬리식 필터 칩 바 */}
      <FilterSheet blogs={blogsQ.data ?? []} value={filter} onChange={setFilter} />

      {/* 글 개수 */}
      <View style={styles.filterRow}>
        <Text style={[styles.countText, { color: c.textSecondary }]}>{countLabel}</Text>
      </View>

      {q.isLoading ? (
        <Loading label="불러오는 중…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="글이 없어요" hint="필터를 바꿔보세요" />
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(a) => a.id}
          renderItem={({ item }) => (
            <ArticleRow article={item} onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })} />
          )}
          ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: c.hairline }]} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
          }}
        />
      )}
    </SafeAreaView>
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
  searchUtil: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },

  filterRow: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  countText: { fontSize: 13, lineHeight: 17, fontWeight: "700" },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sep: { height: 1 },
});
