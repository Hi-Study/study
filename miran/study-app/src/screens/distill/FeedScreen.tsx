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
      ...(filter.levels.size > 0 ? { levels: [...filter.levels] } : {}),
    }),
    [filter.topics, filter.blogIds, filter.levels],
  );
  const q = useArticlesFeed({ ...baseFilter, sort: filter.sort });
  const countQ = useArticlesFeedCount(baseFilter);
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const countLabel = countQ.data != null ? `${countQ.data.toLocaleString()}개` : "";

  // 목록과 같이 스크롤되는 헤더 — 기업 드롭다운 + 필터 칩 + 글 개수.
  const header = (
    <View style={styles.headerWrap}>
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
      <View style={styles.filterRow}>
        <Text style={[styles.countText, { color: c.textSecondary }]}>{countLabel}</Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      {/* ⚠️ 필터를 목록 **위에 고정하지 않는다.** 히어로 카드까지 화면에 붙박이로 남으면
          작은 폰에서 글이 두세 줄밖에 안 보인다. 목록과 함께 스크롤되도록
          FlatList 의 헤더로 넣는다(아래 ListHeaderComponent). */}
      {/* ⚠️ 로딩·빈 상태에서도 **헤더는 남는다.** 예전처럼 분기로 갈아끼우면 결과가 0건일 때
          필터까지 사라져서, 정작 필터를 바꿔야 하는 순간에 바꿀 수가 없다. */}
      <FlatList
        data={rows}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <ArticleRow article={item} onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          q.isLoading ? (
            <Loading label="불러오는 중…" />
          ) : q.isError ? (
            <ErrorState onRetry={() => q.refetch()} />
          ) : (
            <EmptyState title="글이 없어요" hint="필터를 바꿔보세요" />
          )
        }
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: c.hairline }]} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchUtil: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },

  // 헤더는 목록 좌우 패딩(16) 바깥이라 자체 여백을 갖는다.
  headerWrap: { marginHorizontal: -16 },
  // 칩 바 ↔ 개수 ↔ 목록 사이 리듬. 간격 스케일(4·8·12·16·24)만 쓴다.
  filterRow: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 },
  countText: { ...dtype.label },

  // ⚠️ paddingTop 이 없어서 첫 글이 개수 줄에 붙어 있었다.
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
  sep: { height: 1 },
});
