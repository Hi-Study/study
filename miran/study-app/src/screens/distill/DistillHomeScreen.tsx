// distill 홈 — "발견" (회의록 §홈). [인사말+알림] · [맞춤 대표글 좌우 캐러셀] ·
// [서비스 모아보기 4열 그리드(다중선택)] · [선택된 기업들의 글 목록] · [글쓰기 FAB(홈 전용)].
import React, { useMemo, useState } from "react";
import { Dimensions, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, PenLine } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import {
  useBlogs,
  useFeaturedArticles,
  useArticlesFeed,
  useUnreadNotificationCount,
} from "@/data";
import type { BlogRow } from "@/types/tables";
import { dtype } from "@/theme";
import { ArticleCardH, ArticleRow, ServiceLogo } from "@/components/distill/ArticleCards";
import { Loading, ErrorState, EmptyState } from "@/components";

const W = Dimensions.get("window").width;
const CARD_W = Math.round(W * 0.82);
const GRID_COLS = 4;
const GRID_GAP = 10;
const CELL_W = Math.floor((W - 32 - GRID_GAP * (GRID_COLS - 1)) / GRID_COLS);

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "늦은 밤이네요";
  if (h < 11) return "좋은 아침이에요";
  if (h < 18) return "오늘의 테크";
  return "좋은 저녁이에요";
}

// 서비스 모아보기 그리드 셀 — 아이콘(파비콘) + 이름. 탭하면 다중선택 토글.
function BlogCell({
  blog,
  active,
  onPress,
}: {
  blog: BlogRow;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.cell,
        {
          width: CELL_W,
          backgroundColor: active ? c.primaryTint : c.surfaceCard,
          borderColor: active ? c.primary : c.hairline,
        },
      ]}
    >
      <ServiceLogo name={blog.name} brandColor={blog.brand_color} homepage={blog.homepage} blogKey={blog.key} size={38} />
      <Text
        style={[styles.cellText, { color: active ? c.primary : c.textSecondary }]}
        numberOfLines={1}
      >
        {blog.name}
      </Text>
    </Pressable>
  );
}

export function DistillHomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const blogsQ = useBlogs();
  const featuredQ = useFeaturedArticles(6);
  const blogIds = useMemo(() => [...selected], [selected]);
  const feedQ = useArticlesFeed(blogIds.length > 0 ? { blogIds } : {});
  const unread = useUnreadNotificationCount().data ?? 0;

  const blogs = blogsQ.data ?? [];
  const featured = featuredQ.data ?? [];
  const rows = feedQ.data?.pages.flatMap((p) => p.rows) ?? [];

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
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
          if (feedQ.hasNextPage && !feedQ.isFetchingNextPage) feedQ.fetchNextPage();
        }}
        ListEmptyComponent={
          feedQ.isLoading ? (
            <Loading label="불러오는 중…" />
          ) : feedQ.isError ? (
            <ErrorState onRetry={() => feedQ.refetch()} />
          ) : (
            <EmptyState title="글이 없어요" hint="다른 기업을 골라보세요" />
          )
        }
        ListHeaderComponent={
          <View>
            {/* 인사말 + 알림 */}
            <View style={styles.greetRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.greetTitle, { color: c.textPrimary }]}>{greeting()}</Text>
                <Text style={[styles.greetSub, { color: c.textMuted }]}>오늘의 테크 인사이트</Text>
              </View>
              <Pressable
                hitSlop={8}
                style={styles.iconBtn}
                onPress={() => nav.navigate("DistillNotifications")}
              >
                <Bell size={22} color={c.textSecondary} />
                {unread > 0 ? (
                  <View style={[styles.bellDot, { backgroundColor: c.hot, borderColor: c.surfacePage }]} />
                ) : null}
              </Pressable>
            </View>

            {/* 대표글 좌우 캐러셀 */}
            {featured.length > 0 ? (
              <View style={styles.carousel}>
                <FlatList
                  data={featured}
                  keyExtractor={(a) => a.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={CARD_W + 12}
                  decelerationRate="fast"
                  contentContainerStyle={styles.carouselContent}
                  renderItem={({ item }) => (
                    <ArticleCardH
                      article={item}
                      width={CARD_W}
                      onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })}
                    />
                  )}
                />
              </View>
            ) : null}

            {/* 서비스 모아보기 — 4열 그리드(다중선택) */}
            <View style={styles.sectionHead}>
              <Text style={[styles.listLabel, { color: c.textPrimary }]}>서비스 모아보기</Text>
              {selected.size > 0 ? (
                <Pressable hitSlop={8} onPress={() => setSelected(new Set())}>
                  <Text style={[styles.reset, { color: c.primary }]}>전체 보기</Text>
                </Pressable>
              ) : null}
            </View>
            <View style={styles.grid}>
              {blogs.map((b) => (
                <BlogCell key={b.id} blog={b} active={selected.has(b.id)} onPress={() => toggle(b.id)} />
              ))}
            </View>

            <Text style={[styles.listLabel, { color: c.textSecondary, marginTop: 16 }]}>
              {selected.size > 0 ? `선택한 서비스 (${selected.size})` : "최신 글"}
            </Text>
          </View>
        }
      />

      {/* 글쓰기 FAB — 홈 전용 */}
      <Pressable
        onPress={() => nav.navigate("CreateArticle")}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: c.primary, opacity: pressed ? 0.9 : 1 },
        ]}
        hitSlop={8}
      >
        <PenLine size={24} color="#fff" />
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 40 },

  greetRow: { flexDirection: "row", alignItems: "center", paddingTop: 8, paddingBottom: 8, gap: 4 },
  greetTitle: { ...dtype.display },
  greetSub: { ...dtype.body, marginTop: 2 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  bellDot: { position: "absolute", top: 8, right: 9, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },

  carousel: { marginHorizontal: -16, marginTop: 4, marginBottom: 8 },
  carouselContent: { paddingHorizontal: 16, gap: 12 },

  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 10,
  },
  reset: { ...dtype.label, fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: GRID_GAP },
  cell: {
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  cellText: { ...dtype.label, fontSize: 11.5, textAlign: "center" },

  listLabel: { ...dtype.title, marginBottom: 4 },
  sep: { height: 1 },

  fab: {
    position: "absolute",
    right: 18,
    bottom: 22,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
