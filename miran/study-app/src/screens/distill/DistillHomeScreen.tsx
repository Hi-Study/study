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
  useFeaturedArticles,
  usePopularArticles,
  usePopularTags,
  useOpinionsFeed,
  useRecommendedArticles,
  useUnfinishedArticles,
  useCommunityPosts,
  useUnreadNotificationCount,
  useProfile,
  useWeeklyTogether,
} from "@/data";
import type { BlogRow } from "@/types/tables";
import type { ArticleWithBlog } from "@/data/articles";
import { dtype , PRETENDARD} from "@/theme";
import { ArticleCardH, FeaturedCard, ServiceLogo } from "@/components/distill/ArticleCards";
import { OpinionCard } from "@/components/distill/OpinionCard";
import { CommunityCard } from "@/components/distill/CommunityCard";
import { StreakPill } from "@/components/distill/ReadingStatsBadge";
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
  const popularInsights = useOpinionsFeed("popular").data ?? [];
  const latestInsights = useOpinionsFeed("latest").data ?? [];
  const recommended = useRecommendedArticles(10).data ?? [];
  const featured = useFeaturedArticles(10).data ?? [];
  const unfinished = useUnfinishedArticles(10).data ?? [];
  // 섹션 제목대로 "이야기가 오가는" 글 = 댓글·공감 많은 순.
  const community = (useCommunityPosts("active").data ?? []).slice(0, 8);
  const unread = useUnreadNotificationCount().data ?? 0;
  // "이번 주 같이 읽는 글" — 주 1회 지정글을 정하지 않는다(운영 부담 + 아무도 안 읽으면 섹션이 죽음).
  //   최근 7일 안에 이미 여러 명이 읽고 인사이트를 남긴 글을 묶어, "같이 읽는 중"이라는 사실을 보여준다.
  const weekly = useWeeklyTogether(8).data ?? [];

  const loading = blogs.length === 0 && popular.length === 0;

  // 활동이 없는(게스트·신규) 사용자도 섹션이 비지 않게 폴백.
  //  · 추천글 → 이미지 있는 최신 글(③ 인기 글과 겹치지 않게 "인기"가 아닌 "최신"을 쓴다)
  //  · 인기 인사이트 → 최신 인사이트
  const recoFallback = recommended.length === 0;
  const recoList = recoFallback ? featured : recommended;
  const recoTitle = recoFallback
    ? "새로 올라온 글이에요"
    : name
      ? `${name}님이 관심 있을 글이에요`
      : "관심 있을 만한 글이에요";
  const recoSub = recoFallback
    ? "글을 읽을수록 취향에 맞게 추천해드려요"
    : "읽은 글의 주제를 바탕으로 골랐어요";

  const insightsFallback = popularInsights.length === 0;
  const insights = (insightsFallback ? latestInsights : popularInsights).slice(0, 8);
  const insightsTitle = insightsFallback
    ? "방금 올라온 인사이트예요"
    : "이 생각에 공감을 많이 했어요";

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 인사말 + 알림 */}
        <View style={styles.topRow}>
          <Text style={[styles.greetTitle, { color: c.textPrimary }]}>{greeting()}</Text>
          {/* 연속 읽기 — 있을 때만 보인다. 끊겨도 "0일"을 절대 띄우지 않는다(벌칙이 된다). */}
          <StreakPill />
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

        {/* ① 추천 글(맞춤, 활동 없으면 최신 글로 폴백) — 큰 카드 좌우 스와이프 */}
        {recoList.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title={recoTitle} sub={recoSub} />
            <FlatList
              data={recoList}
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

        {/* ①-2 이번 주 같이 읽는 글 — 인기글 묶음(지정글 없음) */}
        {weekly.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader
              title="이번 주 같이 읽고 있어요"
              sub="최근 일주일 동안 인사이트가 많이 붙은 글이에요"
            />
            <ArticleCarousel data={weekly} />
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
                  onPress={() => nav.navigate("Search", { q: t })}
                >
                  <Text style={[styles.tagText, { color: c.textSecondary }]}>#{t}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {/* ⑤ 인기 인사이트(좋아요순, 없으면 최신 인사이트로 폴백) */}
        {insights.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title={insightsTitle} />
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
            <SectionHeader title="커뮤니티에서 이야기 나누고 있어요" sub="댓글·공감이 많은 자유글이에요" />
            <FlatList
              data={community}
              keyExtractor={(p) => p.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              snapToInterval={OPINION_W + 12}
              decelerationRate="fast"
              contentContainerStyle={styles.carouselRow}
              renderItem={({ item }) => (
                <View style={{ width: OPINION_W }}>
                  <CommunityCard
                    post={item}
                    bodyLines={2}
                    onPress={() => nav.navigate("CommunityPostDetail", { postId: item.id })}
                  />
                </View>
              )}
            />
          </View>
        ) : null}

        {/* ⑦ 읽다만 글 — 없으면 캐러셀 대신 안내(섹션이 통째로 사라져 "없어졌다"로 보이지 않게) */}
        <View style={styles.block}>
          <SectionHeader title="마저 읽고 인사이트 남겨볼까요?" sub="읽었지만 아직 생각을 안 남긴 글이에요" />
          {unfinished.length > 0 ? (
            <ArticleCarousel data={unfinished} />
          ) : (
            <View style={[styles.hintCard, { backgroundColor: c.surfaceSunken }]}>
              <Text style={[styles.hintText, { color: c.textSecondary }]}>
                아직 읽다 만 글이 없어요. 글을 끝까지 읽으면 여기에 모여요.
              </Text>
            </View>
          )}
        </View>
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
  tagText: { fontSize: 13.5, lineHeight: 18, fontWeight: "700", fontFamily: PRETENDARD["700"] },

  gridScroll: { paddingRight: 8 },
  grid2row: { flexDirection: "column", flexWrap: "wrap", rowGap: ROW_GAP, columnGap: 10 },
  cell: { alignItems: "center", justifyContent: "center", gap: 8, paddingHorizontal: 2 },
  cellText: { fontSize: 11.5, lineHeight: 15, fontWeight: "700", fontFamily: PRETENDARD["700"], textAlign: "center" },

  hintCard: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 18 },
  hintText: { ...dtype.bodyS },

  sep: { height: 1 },
});
