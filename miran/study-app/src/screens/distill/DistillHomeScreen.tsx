// distill 홈 — "발견" (회의록 §홈).
// [인사말+알림] · [대표글 캐러셀] · [서비스 모아보기 2행 가로 스와이프(다중선택)] ·
// [선택(없으면 전체) 기업별 최신글 가로 캐러셀] · [글쓰기 FAB(홈 전용)].
import React, { useMemo, useState } from "react";
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, ChevronRight, PenLine } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import {
  useBlogs,
  useFeaturedArticles,
  useArticlesByBlog,
  useUnreadNotificationCount,
} from "@/data";
import type { BlogRow } from "@/types/tables";
import { dtype } from "@/theme";
import { ArticleCardH, ServiceLogo } from "@/components/distill/ArticleCards";
import { Loading } from "@/components";

const W = Dimensions.get("window").width;
const CARD_W = Math.round(W * 0.82);
const BLOG_CARD_W = Math.round(W * 0.62);
// 서비스 모아보기 2행 가로 스와이프 셀(약 4.4칸 노출 → 다음 칸 살짝 보여 스와이프 유도).
const CELL_W = Math.round((W - 32) / 4.4);
const CELL_H = 86;
const ROW_GAP = 12;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "늦은 밤이네요";
  if (h < 11) return "좋은 아침이에요";
  if (h < 18) return "오늘의 테크";
  return "좋은 저녁이에요";
}

// 서비스 모아보기 셀 — 아이콘(파비콘) + 이름. 탭하면 다중선택 토글.
function BlogCell({ blog, active, onPress }: { blog: BlogRow; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.cell,
        {
          width: CELL_W,
          height: CELL_H,
          backgroundColor: active ? c.primaryTint : c.surfaceCard,
          borderColor: active ? c.primary : c.hairline,
        },
      ]}
    >
      <ServiceLogo name={blog.name} brandColor={blog.brand_color} homepage={blog.homepage} blogKey={blog.key} size={36} />
      <Text style={[styles.cellText, { color: active ? c.primary : c.textSecondary }]} numberOfLines={1}>
        {blog.name}
      </Text>
    </Pressable>
  );
}

// 기업별 최신글 가로 캐러셀 — 글 없으면 렌더 안 함.
function BlogCarousel({ blog }: { blog: BlogRow }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const q = useArticlesByBlog(blog.id, 10);
  const rows = q.data ?? [];
  if (q.isLoading || rows.length === 0) return null;

  return (
    <View style={styles.blogSection}>
      <Pressable
        style={styles.blogHead}
        onPress={() => nav.navigate("BlogArticles", { blogId: blog.id, blogName: blog.name })}
      >
        <ServiceLogo name={blog.name} brandColor={blog.brand_color} homepage={blog.homepage} blogKey={blog.key} size={24} />
        <Text style={[styles.blogName, { color: c.textPrimary }]}>{blog.name}</Text>
        <ChevronRight size={18} color={c.textMuted} />
      </Pressable>
      <FlatList
        data={rows}
        keyExtractor={(a) => a.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={BLOG_CARD_W + 12}
        decelerationRate="fast"
        contentContainerStyle={styles.blogCarousel}
        renderItem={({ item }) => (
          <ArticleCardH
            article={item}
            width={BLOG_CARD_W}
            onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })}
          />
        )}
      />
    </View>
  );
}

export function DistillHomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const blogsQ = useBlogs();
  const featuredQ = useFeaturedArticles(6);
  const unread = useUnreadNotificationCount().data ?? 0;

  const blogs = blogsQ.data ?? [];
  const featured = featuredQ.data ?? [];
  // 선택된 기업만(없으면 전체)의 캐러셀 표시.
  const shown = useMemo(
    () => (selected.size > 0 ? blogs.filter((b) => selected.has(b.id)) : blogs),
    [blogs, selected],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      <FlatList
        data={shown}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => <BlogCarousel blog={item} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={blogsQ.isLoading ? <Loading label="불러오는 중…" /> : null}
        ListHeaderComponent={
          <View>
            {/* 인사말 + 알림 */}
            <View style={styles.greetRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.greetTitle, { color: c.textPrimary }]}>{greeting()}</Text>
                <Text style={[styles.greetSub, { color: c.textMuted }]}>오늘의 테크 인사이트</Text>
              </View>
              <Pressable hitSlop={8} style={styles.iconBtn} onPress={() => nav.navigate("DistillNotifications")}>
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

            {/* 서비스 모아보기 — 2행 가로 스와이프(다중선택) */}
            <View style={styles.sectionHead}>
              <Text style={[styles.listLabel, { color: c.textPrimary }]}>서비스 모아보기</Text>
              {selected.size > 0 ? (
                <Pressable hitSlop={8} onPress={() => setSelected(new Set())}>
                  <Text style={[styles.reset, { color: c.primary }]}>전체 보기</Text>
                </Pressable>
              ) : null}
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.gridScroll}
            >
              <View style={[styles.grid2row, { height: CELL_H * 2 + ROW_GAP }]}>
                {blogs.map((b) => (
                  <BlogCell key={b.id} blog={b} active={selected.has(b.id)} onPress={() => toggle(b.id)} />
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.listLabel, { color: c.textSecondary, marginTop: 16, marginBottom: 4 }]}>
              {selected.size > 0 ? `선택한 서비스 (${selected.size})` : "기업별 최신글"}
            </Text>
          </View>
        }
      />

      {/* 글쓰기 FAB — 홈 전용 */}
      <Pressable
        onPress={() => nav.navigate("CreateArticle")}
        style={({ pressed }) => [styles.fab, { backgroundColor: c.primary, opacity: pressed ? 0.9 : 1 }]}
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
  listLabel: { ...dtype.title },

  // 2행 가로 스와이프 그리드
  gridScroll: { paddingRight: 8 },
  grid2row: { flexDirection: "column", flexWrap: "wrap", rowGap: ROW_GAP, columnGap: 10 },
  cell: {
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 4,
  },
  cellText: { ...dtype.label, fontSize: 11.5, textAlign: "center" },

  // 기업별 캐러셀
  blogSection: { marginTop: 6, marginBottom: 12 },
  blogHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  blogName: { ...dtype.cardTitle, flex: 1 },
  blogCarousel: { gap: 12, paddingRight: 4 },

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
