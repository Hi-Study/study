// distill 홈 — "발견" (DESIGN_GUIDE §7.1).
//   [그리팅] · [피처드 대표글] · [서비스별 보기 로고 그리드] · [서비스별 아티클 가로 캐러셀]
import React from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, ChevronRight, Search } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useBlogs, useFeaturedArticle, useArticlesByBlog } from "@/data";
import type { BlogRow } from "@/types/tables";
import { dtype } from "@/theme";
import { ArticleCardH, FeaturedCard, ServiceLogo } from "@/components/distill/ArticleCards";
import { Loading, ErrorState } from "@/components";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "늦은 밤이네요";
  if (h < 11) return "좋은 아침이에요";
  if (h < 18) return "오늘의 테크";
  return "좋은 저녁이에요";
}

// 서비스별 가로 캐러셀 — 블로그 최신글이 있을 때만 렌더.
function ServiceCarousel({ blog }: { blog: BlogRow }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const q = useArticlesByBlog(blog.id, 10);
  const items = q.data ?? [];
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <Pressable
        style={styles.sectionHead}
        onPress={() => nav.navigate("BlogArticles", { blogId: blog.id, blogName: blog.name })}
      >
        <ServiceLogo name={blog.name} brandColor={blog.brand_color} size={26} />
        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>{blog.name}</Text>
        <ChevronRight size={18} color={c.textMuted} />
      </Pressable>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carousel}
      >
        {items.map((a) => (
          <ArticleCardH
            key={a.id}
            article={a}
            onPress={() => nav.navigate("ArticleDetail", { articleId: a.id })}
          />
        ))}
      </ScrollView>
    </View>
  );
}

function HomeHeader({ blogs }: { blogs: BlogRow[] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const featured = useFeaturedArticle();

  return (
    <View>
      {/* 그리팅 헤더 */}
      <View style={styles.greetRow}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.greetTitle, { color: c.textPrimary }]}>{greeting()}</Text>
          <Text style={[styles.greetSub, { color: c.textMuted }]}>
            {blogs.length}개 블로그를 한곳에
          </Text>
        </View>
        <Pressable hitSlop={8} style={styles.iconBtn}>
          <Search size={22} color={c.textSecondary} />
        </Pressable>
        <Pressable hitSlop={8} style={styles.iconBtn}>
          <Bell size={22} color={c.textSecondary} />
        </Pressable>
      </View>

      {/* 피처드 대표글 */}
      {featured.data ? (
        <View style={styles.featuredWrap}>
          <FeaturedCard
            article={featured.data}
            onPress={() => nav.navigate("ArticleDetail", { articleId: featured.data!.id })}
          />
        </View>
      ) : null}

      {/* 서비스별 보기 로고 그리드 */}
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: c.textSecondary }]}>서비스별 보기</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.logoGrid}
        >
          {blogs.map((b) => (
            <Pressable
              key={b.id}
              style={styles.logoItem}
              onPress={() => nav.navigate("BlogArticles", { blogId: b.id, blogName: b.name })}
            >
              <ServiceLogo name={b.name} brandColor={b.brand_color} size={52} />
              <Text style={[styles.logoName, { color: c.textSecondary }]} numberOfLines={1}>
                {b.name}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </View>
  );
}

export function DistillHomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const blogsQ = useBlogs();

  if (blogsQ.isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]}>
        <Loading label="불러오는 중…" />
      </SafeAreaView>
    );
  }
  if (blogsQ.isError) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]}>
        <ErrorState onRetry={() => blogsQ.refetch()} />
      </SafeAreaView>
    );
  }

  const blogs = blogsQ.data ?? [];
  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      <FlatList
        data={blogs}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => <ServiceCarousel blog={item} />}
        ListHeaderComponent={<HomeHeader blogs={blogs} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingBottom: 40 },

  greetRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingTop: 8, paddingBottom: 4, gap: 4 },
  greetTitle: { ...dtype.display },
  greetSub: { ...dtype.body, marginTop: 2 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  featuredWrap: { paddingHorizontal: 16, marginTop: 12 },

  section: { marginTop: 24 },
  sectionLabel: { ...dtype.title, paddingHorizontal: 16, marginBottom: 12 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  sectionTitle: { ...dtype.title, flex: 1 },

  logoGrid: { paddingHorizontal: 16, gap: 16 },
  logoItem: { alignItems: "center", width: 60, gap: 6 },
  logoName: { ...dtype.meta, textAlign: "center" },

  carousel: { paddingHorizontal: 16, gap: 12 },
});
