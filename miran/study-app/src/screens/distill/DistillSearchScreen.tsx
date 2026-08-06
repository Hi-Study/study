// distill 검색 탭 (DESIGN_GUIDE §7.3) — 검색 전: 주제 탐색 카드 / 검색 후: 결과 리스트.
import React, { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Search, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useArticlesFeed } from "@/data";
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

  const q = query.trim();
  const active = q.length > 0 || topic !== null;
  const feed = useArticlesFeed(
    active ? { search: q || undefined, topic: topic ?? undefined } : {},
  );
  const rows = feed.data?.pages.flatMap((p) => p.rows) ?? [];

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
        // 검색 전 — 주제 탐색 카드(2열)
        <FlatList
          data={TOPIC_ORDER}
          keyExtractor={(t) => t}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.gridContent}
          ListHeaderComponent={
            <Text style={[styles.browseLabel, { color: c.textSecondary }]}>주제로 둘러보기</Text>
          }
          renderItem={({ item }) => {
            const meta = TOPIC_META[item];
            return (
              <Pressable
                style={[styles.topicCard, { backgroundColor: meta.tint }]}
                onPress={() => setTopic(item)}
              >
                <Text style={[styles.topicCardText, { color: meta.color }]}>{meta.label}</Text>
              </Pressable>
            );
          }}
        />
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

  browseLabel: { ...dtype.title, marginBottom: 12 },
  gridContent: { padding: 16 },
  gridRow: { gap: 12 },
  topicCard: { flex: 1, height: 84, borderRadius: 16, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  topicCardText: { ...dtype.cardTitle, fontWeight: "700" },

  filterChip: { alignSelf: "flex-start", paddingVertical: 6, marginBottom: 4 },
  filterChipText: { ...dtype.label, fontSize: 13 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sep: { height: 1 },
});
