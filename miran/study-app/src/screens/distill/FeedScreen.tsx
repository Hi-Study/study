// distill 피드 탭 — 주제별 테크 글 스트림 (회의록 §피드).
// 현대백화점식 상단: [큰 기업 드롭다운] → [카테고리/정렬 필터 칩] + [개수] + 글 리스트.
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useArticlesFeed, useArticlesFeedCount, useBlogs } from "@/data";
import { dtype } from "@/theme";
import { ArticleRow } from "@/components/distill/ArticleCards";
import { FilterSheet, emptyFilter, type FilterValue } from "@/components/distill/FilterSheet";
import { Loading, ErrorState, EmptyState } from "@/components";

export function FeedScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [filter, setFilter] = useState<FilterValue>(emptyFilter);

  const blogsQ = useBlogs();
  const baseFilter = useMemo(
    () => ({
      ...(filter.topics.size > 0 ? { topics: [...filter.topics] } : {}),
      ...(filter.blogIds.size > 0 ? { blogIds: [...filter.blogIds] } : {}),
    }),
    [filter.topics, filter.blogIds],
  );
  const q = useArticlesFeed({ ...baseFilter, sort: filter.sort });
  const countQ = useArticlesFeedCount(baseFilter);
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const countLabel = countQ.data != null ? `${countQ.data.toLocaleString()}개` : "";

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      {/* 큰 기업 드롭다운(제일 큰 요소) + 그 아래 카테고리/정렬 필터 칩 */}
      <FilterSheet
        blogs={blogsQ.data ?? []}
        value={filter}
        onChange={setFilter}
        eyebrow="지금 보는 곳"
        right={
          <Pressable hitSlop={8} style={styles.searchUtil} onPress={() => nav.navigate("Search")}>
            <Search size={22} color={c.textSecondary} />
          </Pressable>
        }
      />

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
  searchUtil: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },

  filterRow: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 10 },
  countText: { ...dtype.label, fontSize: 13 },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sep: { height: 1 },
});
