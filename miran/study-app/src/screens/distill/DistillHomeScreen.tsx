// distill 홈 — "발견" (DESIGN_GUIDE §7.1).
//   [그리팅] · [피처드 대표글] · [서비스별 보기 로고 그리드] · [서비스별 아티클 가로 캐러셀]
import React, { useMemo } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, ChevronRight, Plus, Search, Star } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import {
  useBlogs,
  useFeaturedArticle,
  useArticlesByBlog,
  useFavoriteBlogIds,
  useToggleBlogFavorite,
} from "@/data";
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
function ServiceCarousel({
  blog,
  favorite,
  onToggleFavorite,
}: {
  blog: BlogRow;
  favorite: boolean;
  onToggleFavorite: (blogId: string, next: boolean) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const q = useArticlesByBlog(blog.id, 10);
  const items = q.data ?? [];
  if (items.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Pressable
          style={styles.sectionHeadMain}
          onPress={() => nav.navigate("BlogArticles", { blogId: blog.id, blogName: blog.name })}
        >
          <ServiceLogo name={blog.name} brandColor={blog.brand_color} size={26} />
          <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>{blog.name}</Text>
          <ChevronRight size={18} color={c.textMuted} />
        </Pressable>
        <Pressable onPress={() => onToggleFavorite(blog.id, !favorite)} hitSlop={8} style={styles.starBtn}>
          <Star
            size={19}
            color={favorite ? c.hot : c.textMuted}
            fill={favorite ? c.hot : "transparent"}
          />
        </Pressable>
      </View>
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

function HomeHeader({
  blogs,
  favSet,
  onToggleFavorite,
}: {
  blogs: BlogRow[];
  favSet: Set<string>;
  onToggleFavorite: (blogId: string, next: boolean) => void;
}) {
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
        <Pressable
          hitSlop={8}
          style={[styles.addBtn, { backgroundColor: c.primary }]}
          onPress={() => nav.navigate("CreateArticle")}
        >
          <Plus size={20} color={c.actionOn} />
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
          {blogs.map((b) => {
            const fav = favSet.has(b.id);
            return (
              <Pressable
                key={b.id}
                style={styles.logoItem}
                onPress={() => nav.navigate("BlogArticles", { blogId: b.id, blogName: b.name })}
              >
                <View style={styles.logoWrap}>
                  <ServiceLogo name={b.name} brandColor={b.brand_color} size={52} />
                  <Pressable
                    onPress={() => onToggleFavorite(b.id, !fav)}
                    hitSlop={6}
                    style={[styles.logoStar, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
                  >
                    <Star size={11} color={fav ? c.hot : c.textMuted} fill={fav ? c.hot : "transparent"} />
                  </Pressable>
                </View>
                <Text style={[styles.logoName, { color: c.textSecondary }]} numberOfLines={1}>
                  {b.name}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </View>
  );
}

export function DistillHomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const blogsQ = useBlogs();
  const favsQ = useFavoriteBlogIds();
  const toggleFav = useToggleBlogFavorite();

  const favSet = useMemo(() => new Set(favsQ.data ?? []), [favsQ.data]);
  const blogs = useMemo(() => {
    const list = blogsQ.data ?? [];
    // 즐겨찾기한 기업을 앞쪽으로(그 외 순서는 원본 유지).
    return [...list].sort((a, b) => (favSet.has(b.id) ? 1 : 0) - (favSet.has(a.id) ? 1 : 0));
  }, [blogsQ.data, favSet]);

  const onToggleFav = (blogId: string, next: boolean) =>
    toggleFav.mutate({ blogId, favorite: next });

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

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      <FlatList
        data={blogs}
        keyExtractor={(b) => b.id}
        renderItem={({ item }) => (
          <ServiceCarousel
            blog={item}
            favorite={favSet.has(item.id)}
            onToggleFavorite={onToggleFav}
          />
        )}
        ListHeaderComponent={
          <HomeHeader blogs={blogs} favSet={favSet} onToggleFavorite={onToggleFav} />
        }
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
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", marginLeft: 2 },

  featuredWrap: { paddingHorizontal: 16, marginTop: 12 },

  section: { marginTop: 24 },
  sectionLabel: { ...dtype.title, paddingHorizontal: 16, marginBottom: 12 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  sectionHeadMain: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  sectionTitle: { ...dtype.title, flex: 1 },
  starBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  logoGrid: { paddingHorizontal: 16, gap: 16 },
  logoItem: { alignItems: "center", width: 60, gap: 6 },
  logoWrap: { width: 52, height: 52 },
  logoStar: { position: "absolute", top: -4, right: -6, width: 20, height: 20, borderRadius: 10, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  logoName: { ...dtype.meta, textAlign: "center" },

  carousel: { paddingHorizontal: 16, gap: 12 },
});
