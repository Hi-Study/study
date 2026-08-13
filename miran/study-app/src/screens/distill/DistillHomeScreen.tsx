// distill 홈 — "발견" (회의록 §홈). [인사말+알림] · [맞춤 대표글 좌우 캐러셀] · [기업 필터 칩] · [필터된 글 목록].
import React, { useState } from "react";
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell } from "lucide-react-native";

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

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "늦은 밤이네요";
  if (h < 11) return "좋은 아침이에요";
  if (h < 18) return "오늘의 테크";
  return "좋은 저녁이에요";
}

// 기업 필터 칩 — 아이콘 + 이름. 선택 시 아래 글 목록을 그 기업으로 필터.
function BlogChip({
  blog,
  active,
  onPress,
}: {
  blog?: BlogRow;
  active: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.blogChip,
        { backgroundColor: active ? c.primaryTint : c.surfaceCard, borderColor: active ? c.primary : c.hairline },
      ]}
    >
      {blog ? (
        <ServiceLogo name={blog.name} brandColor={blog.brand_color} homepage={blog.homepage} size={20} />
      ) : null}
      <Text style={[styles.blogChipText, { color: active ? c.primary : c.textSecondary }]}>
        {blog ? blog.name : "전체"}
      </Text>
    </Pressable>
  );
}

export function DistillHomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [blogId, setBlogId] = useState<string | null>(null);

  const blogsQ = useBlogs();
  const featuredQ = useFeaturedArticles(6);
  const feedQ = useArticlesFeed(blogId ? { blogId } : {});
  const unread = useUnreadNotificationCount().data ?? 0;

  const blogs = blogsQ.data ?? [];
  const featured = featuredQ.data ?? [];
  const rows = feedQ.data?.pages.flatMap((p) => p.rows) ?? [];

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

            {/* 기업 필터 칩 */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              <BlogChip active={blogId === null} onPress={() => setBlogId(null)} />
              {blogs.map((b) => (
                <BlogChip
                  key={b.id}
                  blog={b}
                  active={blogId === b.id}
                  onPress={() => setBlogId(blogId === b.id ? null : b.id)}
                />
              ))}
            </ScrollView>

            <Text style={[styles.listLabel, { color: c.textSecondary }]}>
              {blogId ? blogs.find((b) => b.id === blogId)?.name ?? "글" : "최신 글"}
            </Text>
          </View>
        }
      />
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

  chips: { gap: 8, paddingVertical: 12 },
  blogChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 8,
    paddingRight: 14,
    paddingVertical: 6,
  },
  blogChipText: { ...dtype.label, fontSize: 13 },

  listLabel: { ...dtype.title, marginTop: 4, marginBottom: 4 },
  sep: { height: 1 },
});
