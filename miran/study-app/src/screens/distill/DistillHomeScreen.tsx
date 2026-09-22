/**
 * distill 홈 — **기획자가 "지금 읽을 것"을 받아 가는 화면.**
 *
 * 칸 순서가 곧 들어온 사람의 상태다:
 *   ① 검색            → 찾으러 온 사람
 *   ② 지금 뜨는       → 남들이 뭘 보나 (한 줄 티커, 맨 위)
 *   ③ 오늘의 추천     → 맡기는 사람. 큰 카드 하나.
 *   ④ 이어 읽기       → 읽다 만 게 있는 사람 (없으면 칸째 사라진다)
 *   ⑤ 기업별 모아보기 → 출처로 찾기(로고 한 줄, 관심 기업이 앞)
 *   ⑥ 대분류 주제 피드 → 주제 전체를 훑기
 *   ⑦ 서비스 종류별   → 우리와 비슷한 곳 찾기
 *
 * ⚠️ **취향 분석(주제·기업 막대)은 여기 두지 않는다 — 마이의 것이다.** 홈은 "새로 읽을 것"을
 *    주는 자리고, 내 기록을 돌아보는 자리는 마이다(§7.7).
 *
 * ⚠️ **칸을 줄였다.** 예전엔 열 칸이 넘었고("이런 걸 풀었어요" · "숫자로 답한 글" ·
 *    "이번 주 같이 읽고 있어요" · 보라 배너 …) 그래서 "내용이 너무 많다"는 말을 들었다.
 *    없앤 칸의 역할은 대부분 피드의 필터와 검색이 이미 한다.
 *    "관심 기업의 새 글"만 따로 남기지 않고 **기업별 모아보기에서 관심 기업을 앞으로**
 *    정렬하는 것으로 흡수했다 — 같은 일을 하는 칸을 두 개 두지 않는다.
 *
 * ⚠️ 이 화면에는 **완독률을 두지 않는다.** 완독률과 보관함은 아카이브 탭이 맡는다.
 *    홈은 끝까지 "새로 읽을 것"만 말한다.
 */
import React, { useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, Search, Settings, Star } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import {
  useArticlesByTopic,
  useBlogs,
  useContinueReading,
  useFavoriteBlogIds,
  usePopularArticles,
  useTodayArticle,
  useProfile,
} from "@/data";
import type { BlogRow } from "@/types/tables";
import type { Topic } from "@/types/database";
import type { ArticleWithBlog } from "@/data/articles";
import { dtype, PRETENDARD, TOPIC_META, TOPIC_ORDER } from "@/theme";
import { ArticleCardH, FeaturedCard, ServiceLogo } from "@/components/distill/ArticleCards";
import { StreakPill } from "@/components/distill/ReadingStatsBadge";
import { HotTicker } from "@/components/distill/HotTicker";
import { FavoriteBlogsSheet } from "@/components/distill/FavoriteBlogsSheet";
import {
  SERVICE_KIND_META,
  serviceKindsPresent,
} from "@/lib/serviceKind";
import { Loading } from "@/components";

/**
 * ⚠️ `Dimensions.get()` 을 모듈 최상위에서 읽지 않는다.
 *    그 값은 **페이지가 뜬 순간 한 번만** 잡히고 창 크기를 따라가지 않는다.
 *    웹에서 브라우저를 좁히면 카드 폭이 그대로 남아 화면 밖으로 삐져나갔다(실제 증상).
 *    `useWindowDimensions()` 는 창이 바뀔 때마다 다시 그린다.
 */
/** 화면 폭에서 카드·셀 크기를 낸다. 창이 바뀌면 같이 바뀐다. */
function useCardSizes() {
  const { width } = useWindowDimensions();
  return { cardW: width * 0.62, cellW: (width - 32) / 5.4 };
}
const CELL_H = 72;

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
  const { cardW } = useCardSizes();
  return (
    <FlatList
      data={data}
      keyExtractor={(a) => a.id}
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardW + 12}
      decelerationRate="fast"
      contentContainerStyle={styles.carouselRow}
      renderItem={({ item }) => (
        <ArticleCardH
          article={item}
          width={cardW}
          onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })}
        />
      )}
    />
  );
}

function BlogCell({ blog, favorite }: { blog: BlogRow; favorite: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const { cellW } = useCardSizes();
  return (
    <Pressable
      style={[styles.cell, { width: cellW, height: CELL_H }]}
      onPress={() => nav.navigate("BlogArticles", { blogId: blog.id, blogName: blog.name })}
    >
      <View>
        <ServiceLogo
          name={blog.name}
          brandColor={blog.brand_color}
          homepage={blog.homepage}
          blogKey={blog.key}
          size={38}
        />
        {/* 관심 기업은 **앞자리 + 작은 별**로만 표시한다. 따로 섹션을 만들면
            "관심 기업의 새 글"과 문이 두 개가 된다. */}
        {favorite ? <Star size={11} color={c.hot} fill={c.hot} style={styles.cellStar} /> : null}
      </View>
      <Text style={[styles.cellText, { color: c.textSecondary }]} numberOfLines={1}>
        {blog.name}
      </Text>
    </Pressable>
  );
}

/**
 * 대분류 하나 = 섹션 하나. **칸 목록이 아니라 글이 보여야** 한다.
 *
 * 예전엔 7칸 목록만 깔고 눌러야 글이 나왔다. 그러면 홈에서 할 수 있는 일이 "고르기"뿐이라,
 * 무엇을 고를지 모르는 사람은 아무것도 못 한다.
 *
 * 글이 없는 대분류는 **통째로 숨긴다** — 빈 줄을 보여주면 분류가 비어 있다는 사실만 드러난다.
 */
function TopicSection({ topic }: { topic: Topic }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const meta = TOPIC_META[topic];
  const data = useArticlesByTopic(topic, 8).data ?? [];
  if (data.length === 0) return null;
  return (
    <View style={styles.block}>
      <View style={styles.topicHead}>
        {/* 첫 글자를 타일에 넣었더니("품") 무슨 뜻인지 알 수 없는 네모가 일곱 개 생겼다.
            아이콘은 글자보다 먼저 읽히고, 칸끼리 구분도 확실하다. */}
        <View style={[styles.topicDot, { backgroundColor: meta.tint }]}>
          <meta.icon size={17} color={meta.color} strokeWidth={2.2} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>{meta.label}</Text>
          <Text style={[styles.sectionSub, { color: c.textMuted }]} numberOfLines={1}>
            {meta.blurb}
          </Text>
        </View>
        <Pressable
          style={styles.moreBtn}
          hitSlop={8}
          onPress={() => nav.navigate("DistillTabs", { screen: "Feed", params: { topic } })}
        >
          <Text style={[styles.moreText, { color: c.textMuted }]}>더보기</Text>
          <ChevronRight size={14} color={c.textMuted} />
        </Pressable>
      </View>
      <ArticleCarousel data={data} />
    </View>
  );
}

export function DistillHomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  // 관심 기업 설정 — 기업 로고를 보다가 "얘 즐겨찾기" 하는 흐름이 자연스럽다.
  //   (설정 > 읽기 에도 같은 시트로 들어가는 문이 있다.)
  const [favOpen, setFavOpen] = useState(false);

  const name = useProfile().data?.name?.trim() || "";
  const blogs = useBlogs().data ?? [];
  const favIds = new Set(useFavoriteBlogIds().data ?? []);
  // 오늘의 추천 — 하루에 한 편. 새로고침해도 안 바뀐다(날짜를 씨앗으로 고른다).
  const today = useTodayArticle().data ?? null;
  // 지금 뜨는 아티클 — 티커에 1~10위가 한 개씩 돌아간다.
  const hot = usePopularArticles(10).data ?? [];
  // 이어 읽기 — **완독 기록이 없는데 손댄 흔적이 있는 글**(data/articles.listContinueReading).
  const continuing = useContinueReading(10).data ?? [];

  // 관심 기업이 앞 — 별을 켠 사람에게는 그게 먼저 보여야 한다.
  const sortedBlogs = [...blogs].sort(
    (a, b) => Number(favIds.has(b.id)) - Number(favIds.has(a.id)),
  );

  // 글이 실제로 있는 종류만 — 빈 칸을 눌러 "0개"를 보게 하지 않는다.
  const kinds = serviceKindsPresent(blogs.map((b) => b.key));
  const loading = blogs.length === 0 && !today;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 워드마크 + 유틸 — 알림 벨은 없앴다(알림 기능 자체를 걷어냈다) */}
        <View style={styles.topRow}>
          <Text style={[styles.logo, { color: c.textPrimary }]}>
            distill<Text style={{ color: c.primary }}>.</Text>
          </Text>
          {/* 연속 읽기 — 있을 때만 보인다. 끊겨도 "0일"을 절대 띄우지 않는다(벌칙이 된다). */}
          <StreakPill />
          <View style={{ flex: 1 }} />
          <Pressable hitSlop={8} style={styles.iconBtn} onPress={() => nav.navigate("Search")}>
            <Search size={21} color={c.textPrimary} />
          </Pressable>
          <Pressable hitSlop={8} style={styles.iconBtn} onPress={() => nav.navigate("DisplaySettings")}>
            <Settings size={21} color={c.textPrimary} />
          </Pressable>
        </View>

        {/* ① 검색 */}
        <Pressable
          style={[styles.searchBar, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
          onPress={() => nav.navigate("Search")}
        >
          <Search size={17} color={c.textMuted} />
          <Text style={[styles.searchPlaceholder, { color: c.textMuted }]}>글 제목·주제·태그 검색</Text>
        </Pressable>

        {loading ? <Loading label="불러오는 중…" /> : null}

        {/* ② 지금 뜨는 아티클 — **맨 위 한 줄.** 1위부터 한 개씩 돌아간다
               (카드 열 개를 깔면 또 고르게 된다). 한 줄짜리라 맨 위에서 자리를 거의 안 먹는다. */}
        <HotTicker data={hot} />

        {/* ③ 오늘의 추천 — 하루에 한 편. 큐레이션 앱이 먼저 할 일은 "고르게 하는 것"이 아니라
               **안 골라도 되게 하는 것**이다. 새로고침으로 바뀌지 않는다.
               ⚠️ 틴트 박스 + "오늘의 추천" 배지를 얹어 봤지만 되돌렸다 — 큰 카드 자체가 이미
                  다른 칸과 크기로 구분된다. 배경까지 주면 강조가 두 겹이 되고 칸만 무거워진다. */}
        {today ? (
          <View style={styles.block}>
            <SectionHeader
              title={name ? `${name}님, 오늘은 이 글 어떠세요?` : "오늘은 이 글 어떠세요?"}
              sub="하루에 한 편만 골라드려요"
            />
            <FeaturedCard
              article={today}
              onPress={() => nav.navigate("ArticleDetail", { articleId: today.id })}
            />
          </View>
        ) : null}

        {/* ④ 이어 읽기 — **읽던 게 있을 때만.** 없는 사람에게 빈 칸이나 권유 카드를 주지 않는다.
               오늘의 추천보다 아래에 둔다 — 이 칸은 없는 날이 더 많아서, 위에 두면 "있다 없다"에
               따라 화면 첫인상이 매일 달라진다. */}
        {continuing.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="읽다 만 글이 있어요" sub="밑줄만 긋고 아직 끝내지 않은 글" />
            <ArticleCarousel data={continuing} />
          </View>
        ) : null}

        {/* ⑤ 기업별 모아보기 — 로고 한 줄. 관심 기업이 앞에 온다. */}
        {blogs.length > 0 ? (
          <View style={styles.block}>
            <View style={styles.topicHead}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>기업별로 모아봤어요</Text>
              </View>
              <Pressable style={styles.moreBtn} hitSlop={8} onPress={() => setFavOpen(true)}>
                <Star size={13} color={c.hot} fill={c.hot} />
                <Text style={[styles.moreText, { color: c.textMuted }]}>관심 기업</Text>
              </Pressable>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.cellScroll}>
              <View style={styles.cellRow}>
                {sortedBlogs.map((b) => (
                  <BlogCell key={b.id} blog={b} favorite={favIds.has(b.id)} />
                ))}
              </View>
            </ScrollView>
          </View>
        ) : null}

        {/* ⑥ 대분류 주제 피드 — 주제 전체를 훑는 자리. */}
        <View style={styles.sectionHead}>
          <Text style={[styles.groupTitle, { color: c.textPrimary }]}>어떤 이야기를 찾으세요?</Text>
        </View>
        {TOPIC_ORDER.map((topic) => (
          <TopicSection key={topic} topic={topic} />
        ))}

        {/* ⑦ 서비스 종류 — 기업 이름으로만 모으면 토스·카카오페이·뱅크샐러드가 서로 멀리
               떨어진다. 같은 종류끼리 봐야 "우리랑 비슷한 곳"을 찾을 수 있다. */}
        {kinds.length > 0 ? (
          <View style={styles.block}>
            <SectionHeader title="서비스 종류별로 모았어요" />
            <View style={styles.kindWrap}>
              {kinds.map((k) => (
                <Pressable
                  key={k}
                  style={[styles.kindChip, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
                  onPress={() => nav.navigate("DistillTabs", { screen: "Feed", params: { service: k } })}
                >
                  <Text style={[styles.kindLabel, { color: c.textSecondary }]}>
                    {SERVICE_KIND_META[k].label}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <FavoriteBlogsSheet visible={favOpen} onClose={() => setFavOpen(false)} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32, gap: 14 },

  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  logo: { fontSize: 20, fontWeight: "800", fontFamily: PRETENDARD["800"], letterSpacing: -0.4 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchPlaceholder: { ...dtype.bodyS },

  block: { gap: 10 },
  sectionHead: { gap: 2 },
  sectionTitle: { ...dtype.title },
  sectionSub: { ...dtype.bodyS },


  // 캐러셀은 화면 좌우 여백 밖으로 나가고, 자체 여백으로 첫 카드를 맞춘다.
  carouselRow: { gap: 12, paddingRight: 4 },

  cellScroll: { paddingRight: 4 },
  /** 기업 로고는 **한 줄**로 민다. 2줄 격자는 홈에서 가장 큰 덩어리였다. */
  cellRow: { flexDirection: "row", gap: 6 },
  // 아이콘 왼쪽 끝을 섹션 제목("기업별로…"의 '기')과 맞춘다 — 가운데 정렬이면 안쪽으로 밀려 보인다.
  cell: { alignItems: "flex-start", justifyContent: "flex-start", gap: 5 },
  cellText: { ...dtype.label, fontSize: 11.5, lineHeight: 16 },
  cellStar: { position: "absolute", right: -2, top: -2 },

  // 대분류 섹션 머리 — 색 타일 + 이름 + 큐레이션 한 줄 + 더보기.
  groupTitle: { ...dtype.titleL, fontSize: 20 },
  topicHead: { flexDirection: "row", alignItems: "center", gap: 10 },
  topicDot: { width: 32, height: 32, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  moreBtn: { flexDirection: "row", alignItems: "center", gap: 1 },
  moreText: { ...dtype.meta },

  // 서비스 종류 — 이름만 담는 칩(§3: 칩 radius 999).
  kindWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  kindChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 13, paddingVertical: 7 },
  kindLabel: { ...dtype.label, fontSize: 12.5 },
});
