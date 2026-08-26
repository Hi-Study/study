// distill 홈 — "발견" (회의록 2026-08-18). 순서:
//   [인사말+알림] · [검색바] · ①추천글(맞춤) · ②서비스 모아보기 · ③인기글(조회순) ·
//   ④요즘 뜨는 주제(태그칩) · ⑤인기 인사이트 · ⑥커뮤니티 인기글 · ⑦읽다만 글(없으면 숨김).
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
  useRecommendedArticles,
  useUnfinishedArticles,
  useCommunityPosts,
  useUnreadNotificationCount,
  useProfile,
} from "@/data";
import type { BlogRow } from "@/types/tables";
import type { ArticleWithBlog } from "@/data/articles";
import { dtype } from "@/theme";
import { ArticleCardH, FeaturedCard, ServiceLogo } from "@/components/distill/ArticleCards";
import { OpinionCard } from "@/components/distill/OpinionCard";
import { Loading } from "@/components";

const W = Dimensions.get("window").width;
const HERO_CARD_W = Math.round(W * 0.86); // 관심글 큰 카드(좌우 스와이프, 다음 카드 살짝 노출)
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

  const name = useProfile().data?.name?.trim() || "";
  const blogs = useBlogs().data ?? [];
  const popular = usePopularArticles(10).data ?? [];
  const tags = usePopularTags().data ?? [];
  const insights = (useOpinionsFeed("popular").data ?? []).slice(0, 8);
  const recommended = useRecommendedArticles(10).data ?? [];
  const unfinished = useUnfinishedArticles(10).data ?? [];
  const community = (useCommunityPosts().data ?? []).slice(0, 8);
  const unread = useUnreadNotificationCount().data ?? 0;

  const loading = blogs.length === 0 && popular.length === 0;
  const recoTitle = name ? `${name}님이 관심 있을 글이에요` : "관심 있을 만한 글이에요";

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 인사말 + 알림 */}
        <View style={styles.topRow}>
          <Text style={[styles.greetTitle, { color: c.textPrimary }]}>{greeting()}</Text>
          <Pressable hitSlop={8} style={styles.bellBtn} onPress={() => nav.navigate("DistillNotifications")}>
            <Bell size={22} color={c.textSecondary} />
            {unread > 0 ? (
              <View style={[styles.bellDot, { backgroundColor: c.hot, borderColor: c.surfacePage }]} />
            ) : null}
          </Pressable>
        </View>

        {/* 검색바 */}
        <Pressable style={[styles.searchBar, { backgroundColor: c.surfaceSunken }]} onPress={() => nav.navigate("Search")}>
          <Search size={18} color={c.textMuted} />
          <Text style={[styles.searchPlaceholder, { color: c.textMuted }]}>글 제목·주제·태그 검색</Text>
        </Pressable>

        {loading ? <Loading label="불러오는 중…" /> : null}

        {/* ① 추천 글(맞춤) — 세로 리스트 */}
        {recommended.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title={recoTitle} sub="읽은 글의 주제를 바탕으로 골랐어요" />
            <FlatList
              data={recommended}
              keyExtractor={(a) => a.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={HERO_CARD_W + 12}
              decelerationRate="fast"
              contentContainerStyle={styles.carouselRow}
              renderItem={({ item }) => (
                <View style={{ width: HERO_CARD_W }}>
                  <FeaturedCard
                    article={item}
                    onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })}
                  />
                </View>
              )}
            />
          </View>
        ) : null}

        {/* ② 서비스 모아보기 (기업 아이콘 2행) */}
        {blogs.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="서비스별로 모아봤어요" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gridScroll}>
              <View style={[styles.grid2row, { height: CELL_H * 2 + ROW_GAP }]}>
                {blogs.map((b) => (
                  <BlogCell key={b.id} blog={b} />
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* ③ 인기 글(조회·좋아요 순) */}
        {popular.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="지금 많이 보는 글이에요" />
            <ArticleCarousel data={popular} />
          </View>
        ) : null}

        {/* ④ 요즘 뜨는 주제(태그칩) */}
        {tags.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="요즘 이런 주제가 자주 보여요" />
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

        {/* ⑤ 인기 인사이트(좋아요순) */}
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

        {/* ⑥ 커뮤니티 인기글 */}
        {community.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="커뮤니티에서 이야기 나누고 있어요" />
            {community.map((p, i) => (
              <View key={p.id}>
                {i > 0 ? <View style={[styles.sep, { backgroundColor: c.hairline }]} /> : null}
                <View style={styles.communityRow}>
                  <Text style={[styles.communityTitle, { color: c.textPrimary }]} numberOfLines={1}>
                    {p.title}
                  </Text>
                  <Text style={[styles.communityBody, { color: c.textMuted }]} numberOfLines={1}>
                    {p.body}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* ⑦ 읽다만 글(없으면 숨김) */}
        {unfinished.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="마저 읽고 인사이트 남겨볼까요?" sub="읽었지만 아직 생각을 안 남긴 글이에요" />
            <ArticleCarousel data={unfinished} />
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
  tagText: { fontSize: 13.5, lineHeight: 18, fontWeight: "700" },

  gridScroll: { paddingRight: 8 },
  grid2row: { flexDirection: "column", flexWrap: "wrap", rowGap: ROW_GAP, columnGap: 10 },
  cell: { alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 2 },
  cellText: { fontSize: 11.5, lineHeight: 15, fontWeight: "700", textAlign: "center" },

  communityRow: { paddingVertical: 12, gap: 4 },
  communityTitle: { ...dtype.cardTitle, fontSize: 15 },
  communityBody: { ...dtype.bodyS },

  sep: { height: 1 },
});
