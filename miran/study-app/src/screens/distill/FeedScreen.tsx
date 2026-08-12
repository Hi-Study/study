// distill 피드 탭 — 주제별 테크 글 스트림 (DESIGN_GUIDE §7.2). 순수 '글' 스트림(의견 아님).
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useArticlesFeed, useBlogs, useFavoriteBlogIds } from "@/data";
import { dtype, TOPIC_META, TOPIC_ORDER } from "@/theme";
import type { Topic } from "@/types/database";
import { ArticleRow } from "@/components/distill/ArticleCards";
import { Loading, ErrorState, EmptyState } from "@/components";

export function FeedScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [blogId, setBlogId] = useState<string | null>(null);
  const [sort, setSort] = useState<"latest" | "popular">("latest");

  const blogsQ = useBlogs();
  const favsQ = useFavoriteBlogIds();
  const blogs = useMemo(() => {
    const favSet = new Set(favsQ.data ?? []);
    return [...(blogsQ.data ?? [])].sort(
      (a, b) => (favSet.has(b.id) ? 1 : 0) - (favSet.has(a.id) ? 1 : 0),
    );
  }, [blogsQ.data, favsQ.data]);

  const q = useArticlesFeed({
    ...(topic ? { topic } : {}),
    ...(blogId ? { blogId } : {}),
    sort,
  });
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.textPrimary }]}>피드</Text>
        <View style={styles.sortSeg}>
          {(["latest", "popular"] as const).map((s) => (
            <Pressable key={s} onPress={() => setSort(s)} hitSlop={6}>
              <Text
                style={[
                  styles.sortText,
                  { color: sort === s ? c.primary : c.textMuted, fontWeight: sort === s ? "700" : "500" },
                ]}
              >
                {s === "latest" ? "최신" : "인기"}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      {/* 주제 칩 */}
      <View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip label="전체" active={topic === null} onPress={() => setTopic(null)} />
          {TOPIC_ORDER.map((t) => (
            <Chip
              key={t}
              label={TOPIC_META[t].label}
              active={topic === t}
              onPress={() => setTopic(t)}
            />
          ))}
        </ScrollView>
      </View>

      {/* 기업 칩 */}
      {blogs.length > 0 ? (
        <View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chips}
          >
            <Chip label="전체 기업" active={blogId === null} onPress={() => setBlogId(null)} />
            {blogs.map((b) => (
              <Chip
                key={b.id}
                label={b.name}
                active={blogId === b.id}
                onPress={() => setBlogId(blogId === b.id ? null : b.id)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {q.isLoading ? (
        <Loading label="불러오는 중…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="글이 없어요" hint="다른 주제를 골라보세요" />
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
    alignItems: "flex-end",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { ...dtype.display },
  sortSeg: { flexDirection: "row", gap: 14, paddingBottom: 4 },
  sortText: { ...dtype.cardTitle, fontSize: 14 },
  chips: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { ...dtype.label, fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sep: { height: 1 },
});
