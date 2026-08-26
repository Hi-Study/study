// distill 피드 탭 — 주제별 테크 글 스트림 (회의록 §피드).
// 최상단 기업 드롭다운 + 주제 탭 + [개수 좌·정렬 우] + 글 리스트.
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useArticlesFeed, useArticlesFeedCount, useBlogs } from "@/data";
import { dtype, TOPIC_META, TOPIC_ORDER } from "@/theme";
import type { Topic } from "@/types/database";
import { ArticleRow } from "@/components/distill/ArticleCards";
import { BlogChipsBar } from "@/components/distill/BlogChipsBar";
import { Loading, ErrorState, EmptyState } from "@/components";

export function FeedScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [blogSel, setBlogSel] = useState<Set<string>>(new Set());

  const blogsQ = useBlogs();
  const blogIds = useMemo(() => [...blogSel], [blogSel]);
  // 정렬 무관한 기본 필터(주제+기업) — 피드와 개수 쿼리가 공유. 정렬 토글 시 개수는 재요청 안 함.
  const baseFilter = useMemo(
    () => ({ ...(topic ? { topic } : {}), ...(blogIds.length > 0 ? { blogIds } : {}) }),
    [topic, blogIds],
  );
  const q = useArticlesFeed({ ...baseFilter, sort });
  const countQ = useArticlesFeedCount(baseFilter);
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const countLabel = countQ.data != null ? `${countQ.data.toLocaleString()}개` : "";

  const toggleBlog = (id: string) =>
    setBlogSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      {/* 제목 + 검색 유틸 */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.textPrimary }]}>피드</Text>
        <Pressable hitSlop={8} style={styles.searchUtil} onPress={() => nav.navigate("Search")}>
          <Search size={22} color={c.textSecondary} />
        </Pressable>
      </View>

      {/* 최상단 기업 드롭다운(무신사식 — 눌러서 리스트 펼침) */}
      <BlogChipsBar
        blogs={blogsQ.data ?? []}
        selected={blogSel}
        onToggle={toggleBlog}
        onClear={() => setBlogSel(new Set())}
      />

      {/* 주제 탭 */}
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

      {/* 글 개수(좌) + 정렬(우) */}
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
      ) : rows.length === 0 ? (
        <EmptyState title="글이 없어요" hint="주제·기업 필터를 바꿔보세요" />
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
  searchUtil: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },

  chips: { paddingHorizontal: 16, paddingVertical: 8, gap: 8, alignItems: "center" },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: "700" },

  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  sortSeg: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  sortBtnText: { fontSize: 12.5, lineHeight: 17, fontWeight: "700" },
  countText: { fontSize: 13, lineHeight: 17, fontWeight: "700" },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sep: { height: 1 },
});
