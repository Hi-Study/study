// distill 홈 — "발견" (회의록 2026-08-18 §홈 큐레이션 8섹션).
// [검색바] · ①오늘의 글(히어로) · ②인기 키워드 칩 · 서비스 모아보기(기업 아이콘) ·
// ④인기 글 · ⑤인기 인사이트 · ⑥추천 글 · ⑦즐겨찾기 기업 새 글 · ⑧사용자 등록 글.
import React from "react";
import { Dimensions, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Bell, Search } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import {
  useBlogs,
  usePopularArticles,
  usePopularTags,
  useOpinionsFeed,
  useFavoriteBlogArticles,
  useRecommendedArticles,
  useDirectArticles,
  useUnreadNotificationCount,
} from "@/data";
import type { BlogRow } from "@/types/tables";
import type { ArticleWithBlog } from "@/data/articles";
import { dtype } from "@/theme";
import { ArticleCardH, ArticleRow, FeaturedCard, ServiceLogo } from "@/components/distill/ArticleCards";
import { OpinionCard } from "@/components/distill/OpinionCard";
import { Loading } from "@/components";

const W = Dimensions.get("window").width;
const CARD_W = Math.round(W * 0.62);
const OPINION_W = Math.round(W * 0.82);
const CELL_W = Math.round((W - 32) / 4.4);
const CELL_H = 84;
const ROW_GAP = 12;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "늦은 밤이네요";
  if (h < 11) return "좋은 아침이에요";
  if (h < 18) return "오늘의 테크";
  return "좋은 저녁이에요";
}

function SectionHeader({ title, sub }: { title: string; sub?: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.sectionHead}>
      <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>{title}</Text>
      {sub ? <Text style={[styles.sectionSub, { color: c.textMuted }]}>{sub}</Text> : null}
    </View>
  );
}

// 가로 캐러셀(글) — 공통.
function ArticleCarousel({ data }: { data: ArticleWithBlog[] }) {
  const nav = useRootNav();
  return (
    <FlatList
      data={data}
      keyExtractor={(a) => a.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={CARD_W + 12}
      decelerationRate="fast"
      contentContainerStyle={styles.carouselRow}
      renderItem={({ item }) => (
        <ArticleCardH
          article={item}
          width={CARD_W}
          onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })}
        />
      )}
    />
  );
}

// 서비스 모아보기 셀 — 카드 없이 아이콘+텍스트. 탭 시 기업 상세로.
function BlogCell({ blog }: { blog: BlogRow }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  return (
    <Pressable
      style={[styles.cell, { width: CELL_W, height: CELL_H }]}
      onPress={() => nav.navigate("BlogArticles", { blogId: blog.id, blogName: blog.name })}
    >
      <ServiceLogo name={blog.name} brandColor={blog.brand_color} homepage={blog.homepage} blogKey={blog.key} size={44} />
      <Text style={[styles.cellText, { color: c.textSecondary }]} numberOfLines={1}>
        {blog.name}
      </Text>
    </Pressable>
  );
}

export function DistillHomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();

  const blogs = useBlogs().data ?? [];
  const popular = usePopularArticles(10).data ?? [];
  const tags = usePopularTags().data ?? [];
  const insights = (useOpinionsFeed("popular").data ?? []).slice(0, 8);
  const favArticles = useFavoriteBlogArticles(10).data ?? [];
  const recommended = useRecommendedArticles(10).data ?? [];
  const direct = useDirectArticles(10).data ?? [];
  const unread = useUnreadNotificationCount().data ?? 0;

  const hero = popular[0];
  const popularRest = popular.slice(1);
  const loading = blogs.length === 0 && popular.length === 0;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 인사말 + 알림 */}
        <View style={styles.topRow}>
          <Text style={[styles.greetTitle, { color: c.textPrimary }]}>{greeting()}</Text>
          <Pressable
            hitSlop={8}
            style={styles.bellBtn}
            onPress={() => nav.navigate("DistillNotifications")}
          >
            <Bell size={22} color={c.textSecondary} />
            {unread > 0 ? (
              <View style={[styles.bellDot, { backgroundColor: c.hot, borderColor: c.surfacePage }]} />
            ) : null}
          </Pressable>
        </View>

        {/* 검색바 (홈 전용) */}
        <Pressable
          style={[styles.searchBar, { backgroundColor: c.surfaceSunken }]}
          onPress={() => nav.navigate("Search")}
        >
          <Search size={18} color={c.textMuted} />
          <Text style={[styles.searchPlaceholder, { color: c.textMuted }]}>글 제목·주제·태그 검색</Text>
        </Pressable>

        {loading ? <Loading label="불러오는 중…" /> : null}

        {/* ① 오늘의 글 (히어로) */}
        {hero ? (
          <View style={styles.block}>
            <FeaturedCard article={hero} onPress={() => nav.navigate("ArticleDetail", { articleId: hero.id })} />
          </View>
        ) : null}

        {/* ② 인기 키워드 칩 */}
        {tags.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="요즘 이 단어들이 자주 보여요" />
            <View style={styles.tagWrap}>
              {tags.slice(0, 8).map((t) => (
                <Pressable
                  key={t}
                  style={[styles.tagChip, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
                  onPress={() => nav.navigate("Search")}
                >
                  <Text style={[styles.tagText, { color: c.textSecondary }]}>#{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* 서비스 모아보기 (기업 아이콘) */}
        {blogs.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="서비스 모아보기" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridScroll}>
              <View style={[styles.grid2row, { height: CELL_H * 2 + ROW_GAP }]}>
                {blogs.map((b) => (
                  <BlogCell key={b.id} blog={b} />
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* ④ 인기 글 */}
        {popularRest.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="인사이트를 많이 남겼어요" />
            <ArticleCarousel data={popularRest} />
          </View>
        ) : null}

        {/* ⑤ 인기 인사이트 */}
        {insights.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="이 생각에 공감을 많이 했어요" />
            <FlatList
              data={insights}
              keyExtractor={(o) => o.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={OPINION_W + 12}
              decelerationRate="fast"
              contentContainerStyle={styles.carouselRow}
              renderItem={({ item }) => (
                <View style={{ width: OPINION_W }}>
                  <OpinionCard
                    opinion={item}
                    onPress={() =>
                      item.article
                        ? nav.navigate("ArticleDetail", { articleId: item.article.id, focusOpinionId: item.id })
                        : nav.navigate("OpinionDetail", { opinionId: item.id })
                    }
                  />
                </View>
              )}
            />
          </View>
        ) : null}

        {/* ⑦ 즐겨찾기 기업 새 글 */}
        {favArticles.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="관심 기업에 새 글이 올라왔어요" />
            <ArticleCarousel data={favArticles} />
          </View>
        ) : null}

        {/* ⑧ 사용자 등록 글 */}
        {direct.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="인사이터가 직접 소개하는 글이에요" />
            <ArticleCarousel data={direct} />
          </View>
        ) : null}

        {/* ⑥ 추천 글 (세로 리스트) */}
        {recommended.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="이 글도 관심이 있을 것 같아요" />
            {recommended.map((a, i) => (
              <View key={a.id}>
                {i > 0 ? <View style={[styles.sep, { backgroundColor: c.hairline }]} /> : null}
                <ArticleRow article={a} onPress={() => nav.navigate("ArticleDetail", { articleId: a.id })} />
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingBottom: 40 },

  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 8 },
  greetTitle: { ...dtype.display },
  bellBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  bellDot: { position: "absolute", top: 8, right: 9, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 46,
    marginTop: 10,
  },
  searchPlaceholder: { ...dtype.body },

  block: { marginTop: 22 },
  sectionHead: { marginBottom: 12 },
  sectionTitle: { ...dtype.title },
  sectionSub: { ...dtype.bodyS, marginTop: 2 },

  carouselRow: { gap: 12, paddingRight: 4 },

  tagWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tagChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 8 },
  tagText: { ...dtype.label, fontSize: 13.5 },

  gridScroll: { paddingRight: 8 },
  grid2row: { flexDirection: "column", flexWrap: "wrap", rowGap: ROW_GAP, columnGap: 10 },
  cell: { alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 2 },
  cellText: { ...dtype.label, fontSize: 11.5, textAlign: "center" },

  sep: { height: 1 },
});
