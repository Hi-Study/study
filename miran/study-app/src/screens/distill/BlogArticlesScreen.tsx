// distill 블로그별 아티클 목록 — 홈의 서비스 로고/캐러셀 헤더 탭으로 진입.
// 그 블로그가 가진 주제(카테고리)로 필터해서 볼 수 있다.
import React, { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { useArticlesFeed, useBlogTopics } from "@/data";
import { dtype, TOPIC_META, TOPIC_ORDER } from "@/theme";
import type { Topic } from "@/types/database";
import { ArticleRow } from "@/components/distill/ArticleCards";
import { Loading, ErrorState, EmptyState } from "@/components";

type Props = NativeStackScreenProps<RootStackParamList, "BlogArticles">;

export function BlogArticlesScreen({ route }: Props) {
  const { blogId, blogName } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [topic, setTopic] = useState<Topic | null>(null);

  const topicsQ = useBlogTopics(blogId);
  const available = TOPIC_ORDER.filter((t) => (topicsQ.data ?? []).includes(t));

  const q = useArticlesFeed({ blogId, topic: topic ?? undefined });
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: c.hairline }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.backBtn}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.textPrimary }]} numberOfLines={1}>
          {blogName}
        </Text>
        <View style={styles.backBtn} />
      </View>

      {/* 카테고리 칩 (블로그가 가진 주제만) */}
      {available.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chips}
        >
          <Chip label="전체" active={topic === null} onPress={() => setTopic(null)} />
          {available.map((t) => (
            <Chip
              key={t}
              label={TOPIC_META[t].label}
              active={topic === t}
              onPress={() => setTopic(t)}
            />
          ))}
        </ScrollView>
      ) : null}

      {q.isLoading ? (
        <Loading label="불러오는 중…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="글이 없어요" hint={topic ? "다른 카테고리를 골라보세요" : undefined} />
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
          ItemSeparatorComponent={() => (
            <View style={[styles.sep, { backgroundColor: c.hairline }]} />
          )}
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
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...dtype.title, flex: 1, textAlign: "center" },

  chips: { paddingHorizontal: 16, paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { ...dtype.label, fontSize: 13 },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  sep: { height: 1 },
});
