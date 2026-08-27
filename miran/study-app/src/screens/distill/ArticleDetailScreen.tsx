// distill 글 상세 — 원문(DESIGN_GUIDE §7.4).
//   [히어로 + 뒤로] · 주제칩·읽기시간 · 제목 · 출처칩·작성일 · 본문 · 원문보기↗ · 하단 CTA
// TODO(B-2 확장): 본문 문장 하이라이트(article_highlights) + 하단 인사이트 모아보기.
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Linking,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from "react-native";

const HERO_H = Math.round(Dimensions.get("window").width * (9 / 16));
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  Bookmark,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
  ExternalLink,
  MessageSquare,
  Share2,
} from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { dtype } from "@/theme";
import { cleanBody } from "@/lib/text";
import { safeImageUri } from "@/lib/image";
import { splitInsightSections, isStructuredInsight } from "@/lib/summary";
import { useReadingFontScale, getReadPos, setReadPos, clearReadPos } from "@/lib/readingPrefs";
import {
  useArticle,
  useOpinions,
  useRequestArticleSummary,
  useIsBookmarked,
  useToggleBookmark,
  useMarkArticleRead,
  incrementArticleView,
} from "@/data";
import { ServiceLogo, TopicChip, relativeDate } from "@/components/distill/ArticleCards";
import { ArticleHighlightSection } from "@/components/distill/ArticleHighlightSection";
import { OpinionThread } from "@/components/distill/OpinionThread";
import { InsightBody } from "@/components/distill/InsightBody";
import { Avatar } from "@/components/Avatar";
import { Loading, ErrorState } from "@/components";

type Props = NativeStackScreenProps<RootStackParamList, "ArticleDetail">;

export function ArticleDetailScreen({ route }: Props) {
  const { articleId, focusOpinionId } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const q = useArticle(articleId);
  // ⚠️ 훅은 early return 앞에서 무조건 호출 (React 훅 규칙 — 렌더마다 개수 동일).
  const [tab, setTab] = useState<"original" | "opinions">("original");
  const bookmarked = useIsBookmarked(articleId);
  const toggleBookmark = useToggleBookmark(articleId);
  const markRead = useMarkArticleRead(articleId);
  const readMarked = useRef(false);
  const { scale, step } = useReadingFontScale();
  const scrollRef = useRef<ScrollView>(null);
  const [resumeY, setResumeY] = useState(0);
  const tabsY = useRef(0);

  // 이어읽기 — 이전에 읽던 위치 불러오기(자동 스크롤 대신 '이어읽기' 버튼으로 이동).
  useEffect(() => {
    getReadPos(articleId).then(setResumeY);
  }, [articleId]);

  // 조회수 +1 (글 열람 시 1회).
  useEffect(() => {
    incrementArticleView(articleId).catch(() => undefined);
  }, [articleId]);

  // 인사이트 카드로 진입(focusOpinionId) → 의견 탭 열고 그 영역으로 스크롤.
  useEffect(() => {
    if (!focusOpinionId) return;
    setTab("opinions");
    const t = setTimeout(
      () => scrollRef.current?.scrollTo({ y: HERO_H + tabsY.current - 12, animated: true }),
      350,
    );
    return () => clearTimeout(t);
  }, [focusOpinionId]);

  if (q.isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]}>
        <Loading label="불러오는 중…" />
      </SafeAreaView>
    );
  }
  if (q.isError || !q.data) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]}>
        <ErrorState onRetry={() => q.refetch()} />
      </SafeAreaView>
    );
  }

  const a = q.data;
  const body = cleanBody(a.body);

  return (
    <View style={[styles.screen, { backgroundColor: c.surfacePage }]}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={200}
        onScroll={(e) => {
          if (readMarked.current) return;
          const { contentOffset, layoutMeasurement, contentSize } = e.nativeEvent;
          if (
            contentSize.height > 0 &&
            (contentOffset.y + layoutMeasurement.height) / contentSize.height >= 0.9
          ) {
            readMarked.current = true;
            markRead.mutate();
            clearReadPos(articleId); // 다 읽으면 이어읽기 위치 제거
            setResumeY(0);
          }
        }}
        onScrollEndDrag={(e) => setReadPos(articleId, e.nativeEvent.contentOffset.y)}
        onMomentumScrollEnd={(e) => setReadPos(articleId, e.nativeEvent.contentOffset.y)}
      >
        {/* 히어로 */}
        <View style={[styles.hero, { backgroundColor: c.surfaceSunken }]}>
          {a.og_image ? (
            <Image source={{ uri: safeImageUri(a.og_image) }} style={styles.heroImg} resizeMode="cover" />
          ) : null}
        </View>

        <View style={styles.body}>
          {/* 주제칩 · 읽기시간 · 공유·북마크 */}
          <View style={styles.metaTop}>
            {a.topic ? <TopicChip topic={a.topic} /> : null}
            <View style={{ flex: 1 }} />
            <Pressable
              onPress={() => Share.share({ message: `${a.title}\n${a.url}` }).catch(() => undefined)}
              hitSlop={8}
              style={styles.bookmarkBtn}
            >
              <Share2 size={18} color={c.textMuted} />
            </Pressable>
            <Pressable
              onPress={() => toggleBookmark.mutate(!(bookmarked.data ?? false))}
              disabled={toggleBookmark.isPending}
              hitSlop={8}
              style={styles.bookmarkBtn}
            >
              <Bookmark
                size={18}
                color={bookmarked.data ? c.primary : c.textMuted}
                fill={bookmarked.data ? c.primary : "transparent"}
              />
            </Pressable>
          </View>

          {/* 제목 */}
          <Text style={[styles.title, { color: c.textPrimary }]}>{a.title}</Text>

          {/* 키워드 태그 */}
          {a.tags && a.tags.length > 0 ? (
            <View style={styles.tagRow}>
              {a.tags.slice(0, 6).map((tg) => (
                <View key={tg} style={[styles.tagChip, { backgroundColor: c.surfaceSunken }]}>
                  <Text style={[styles.tagText, { color: c.textSecondary }]}>#{tg}</Text>
                </View>
              ))}
            </View>
          ) : null}

          {/* 출처 + 작성일 — 탭하면 기업 상세로 이동 */}
          <Pressable
            style={styles.source}
            onPress={() =>
              a.blog ? nav.navigate("BlogArticles", { blogId: a.blog_id, blogName: a.blog.name }) : undefined
            }
            disabled={!a.blog}
          >
            <ServiceLogo name={a.blog?.name ?? "?"} brandColor={a.blog?.brand_color} homepage={a.blog?.homepage} blogKey={a.blog?.key} size={24} />
            <Text style={[styles.sourceText, { color: c.textSecondary }]}>
              {a.blog?.name ?? ""}
              {a.author ? ` · ${a.author}` : ""}
              {a.published_at ? ` · ${relativeDate(a.published_at)}` : ""}
            </Text>
            {a.blog ? <ChevronRight size={16} color={c.textMuted} /> : null}
          </Pressable>

          {/* 원문 보기 */}
          <Pressable
            style={[styles.sourceLink, { borderColor: c.hairline }]}
            onPress={() => Linking.openURL(a.url).catch(() => undefined)}
          >
            <Text style={[styles.sourceLinkText, { color: c.textLink }]} numberOfLines={1}>
              원문에서 읽기
            </Text>
            <ExternalLink size={16} color={c.textLink} />
          </Pressable>

          {/* 원문 / 의견 탭 */}
          <View
            style={[styles.tabs, { borderColor: c.hairline }]}
            onLayout={(e) => {
              tabsY.current = e.nativeEvent.layout.y;
            }}
          >
            {(["original", "opinions"] as const).map((t) => {
              const label = t === "original" ? "원문" : "인사이트";
              const on = tab === t;
              return (
                <Pressable
                  key={t}
                  style={[styles.tab, on && { backgroundColor: c.primaryTint }]}
                  onPress={() => setTab(t)}
                >
                  <Text style={[styles.tabText, { color: on ? c.primary : c.textMuted }]}>{label}</Text>
                </Pressable>
              );
            })}
          </View>

          {tab === "original" ? (
            <View style={styles.originalWrap}>
              {/* AI 요약(3관점) — 원문 최상단 고정 */}
              <AiSummaryPanel
                articleId={a.id}
                cached={a.ai_summaries as Record<string, string> | null | undefined}
              />
              {body.length > 0 ? (
                <View style={{ gap: 10 }}>
                  {/* 글자 크기 조절 */}
                  <View style={styles.fontRow}>
                    <Pressable
                      onPress={() => step(-1)}
                      hitSlop={6}
                      style={[styles.fontBtn, { borderColor: c.hairline }]}
                    >
                      <Text style={{ color: c.textSecondary, fontSize: 13, fontWeight: "700" }}>가</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => step(1)}
                      hitSlop={6}
                      style={[styles.fontBtn, { borderColor: c.hairline }]}
                    >
                      <Text style={{ color: c.textSecondary, fontSize: 18, fontWeight: "700" }}>가</Text>
                    </Pressable>
                  </View>
                  <ArticleHighlightSection articleId={a.id} text={body} fontScale={scale} />
                </View>
              ) : (
                <Text style={[styles.paragraph, { color: c.textMuted }]}>
                  본문이 없어요. 원문에서 읽어보세요.
                </Text>
              )}
            </View>
          ) : (
            <OpinionsSection articleId={a.id} />
          )}
        </View>
      </ScrollView>

      {/* 플로팅 뒤로가기 */}
      <SafeAreaView style={styles.backWrap} edges={["top"]} pointerEvents="box-none">
        <Pressable
          style={[styles.backBtn, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
          onPress={() => nav.goBack()}
          hitSlop={8}
        >
          <ChevronLeft size={22} color={c.textPrimary} />
        </Pressable>
      </SafeAreaView>

      {/* 이어읽기 (이전에 읽던 위치가 있으면) */}
      {tab === "original" && resumeY > 600 ? (
        <View style={styles.resumeWrap} pointerEvents="box-none">
          <Pressable
            style={[styles.resumePill, { backgroundColor: c.textPrimary }]}
            onPress={() => {
              scrollRef.current?.scrollTo({ y: resumeY, animated: true });
              setResumeY(0);
            }}
          >
            <CornerDownLeft size={15} color={c.surfacePage} />
            <Text style={[styles.resumeText, { color: c.surfacePage }]}>이어읽기</Text>
          </Pressable>
        </View>
      ) : null}

      {/* 하단 고정 CTA */}
      <SafeAreaView style={[styles.ctaWrap, { backgroundColor: c.surfaceCard, borderTopColor: c.hairline }]} edges={["bottom"]}>
        <Pressable
          style={[styles.cta, { backgroundColor: c.primary }]}
          onPress={() => nav.navigate("CreateOpinion", { articleId: a.id })}
        >
          <Text style={[styles.ctaText, { color: c.actionOn }]}>내 생각도 남겨볼까요?</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

// AI 요약 패널 — 3관점 고정(무슨 문제/어떻게 해결/디자이너·PM 관점 배울 점) + 쉽게 풀기(선택).
function AiSummaryPanel({
  articleId,
  cached,
}: {
  articleId: string;
  cached: Record<string, string> | null | undefined;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [results, setResults] = useState<Record<string, string>>({ ...(cached ?? {}) });
  const [running, setRunning] = useState<string | null>(null);
  const req = useRequestArticleSummary(articleId);

  const run = (m: "insight" | "explain") => {
    if (running) return;
    // insight 는 '3관점 구조'가 이미 있으면 재생성 안 함(구형/단일 캐시는 재생성 허용).
    if (m === "insight" && isStructuredInsight(results.insight)) return;
    if (m === "explain" && results.explain) return;
    setRunning(m);
    req.mutate(m, {
      onSuccess: (s) => {
        if (s) setResults((p) => ({ ...p, [m]: s }));
        setRunning(null);
      },
      onError: () => setRunning(null),
    });
  };

  // AI 요약 탭 진입 시 3관점을 자동 생성. 캐시가 구형(단일 요약)이면 새 프롬프트로 재생성.
  useEffect(() => {
    if (!isStructuredInsight(results.insight)) run("insight");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 구조화된 3관점이 있으면 그걸, 아직 없으면(재생성 중/실패) 있는 텍스트라도 파싱.
  const sections = isStructuredInsight(results.insight)
    ? splitInsightSections(results.insight)
    : running === "insight"
      ? []
      : results.insight
        ? splitInsightSections(results.insight)
        : [];

  return (
    <View style={styles.ai}>
      {sections.length > 0 ? (
        sections.map((s, i) => (
          <View
            key={i}
            style={[styles.aiCard, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
          >
            <View style={styles.aiCardHead}>
              <View style={[styles.aiNum, { backgroundColor: c.primaryTint }]}>
                <Text style={[styles.aiNumText, { color: c.primary }]}>{i + 1}</Text>
              </View>
              <Text style={[styles.aiCardTitle, { color: c.textPrimary }]}>{s.title}</Text>
            </View>
            {s.body ? <Text style={[styles.aiCardBody, { color: c.textSecondary }]}>{s.body}</Text> : null}
          </View>
        ))
      ) : running === "insight" ? (
        <View style={styles.aiLoading}>
          <ActivityIndicator color={c.primary} />
          <Text style={[styles.aiHint, { color: c.textMuted }]}>3가지 관점으로 정리하고 있어요…</Text>
        </View>
      ) : (
        <Pressable style={[styles.aiRun, { backgroundColor: c.primary }]} onPress={() => run("insight")}>
          <Text style={[styles.aiRunText, { color: c.actionOn }]}>AI 요약 생성</Text>
        </Pressable>
      )}

      {/* 쉽게 풀기(선택) */}
      {sections.length > 0 ? (
        results.explain ? (
          <View style={[styles.aiCard, { backgroundColor: c.primaryTint, borderColor: c.primaryTint }]}>
            <Text style={[styles.aiCardTitle, { color: c.primary, marginBottom: 6 }]}>쉽게 풀면</Text>
            <Text style={[styles.aiCardBody, { color: c.textPrimary }]}>{results.explain}</Text>
          </View>
        ) : (
          <Pressable
            style={[styles.aiExplain, { borderColor: c.hairline }]}
            onPress={() => run("explain")}
            disabled={running === "explain"}
          >
            {running === "explain" ? (
              <ActivityIndicator color={c.primary} />
            ) : (
              <Text style={[styles.aiExplainText, { color: c.primary }]}>🍬 더 쉽게 풀어서 보기</Text>
            )}
          </Pressable>
        )
      ) : null}
    </View>
  );
}

// 이 글의 의견 탭 — 전체 목록, 탭하면 의견 상세(댓글·좋아요·수정삭제). 아래 CTA로 작성.
function OpinionsSection({ articleId }: { articleId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const q = useOpinions(articleId);
  const list = q.data ?? [];

  if (list.length === 0) {
    return (
      <View style={styles.opinionsEmpty}>
        <Text style={[styles.opinionsEmptyText, { color: c.textMuted }]}>
          아직 의견이 없어요.{"\n"}아래 "내 생각도 남겨볼까요?"로 첫 인사이트를 남겨보세요.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.opinions}>
      <Text style={[styles.opinionsTitle, { color: c.textPrimary }]}>인사이트 {list.length}</Text>
      {list.map((o) => {
        return (
          <View
            key={o.id}
            style={[styles.opinionCard, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
          >
            <View style={styles.opinionHead}>
              <Avatar name={o.author?.name ?? "게스트"} size={28} />
              <Text style={[styles.opinionWho, { color: c.textPrimary }]}>
                {o.author?.name ?? "게스트"}
              </Text>
            </View>
            {/* 인사이트 전체 내용 항상 펼침 + 좋아요/댓글(인라인) */}
            <InsightBody insight={o.insight} />
            <OpinionThread opinionId={o.id} />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 24 },

  hero: { width: "100%", aspectRatio: 16 / 9 },
  heroImg: { width: "100%", height: "100%" },

  body: { paddingHorizontal: 16, paddingTop: 16 },
  metaTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  readTime: { ...dtype.meta },
  bookmarkBtn: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  fontRow: { flexDirection: "row", justifyContent: "flex-end", gap: 8 },
  fontBtn: { width: 38, height: 32, borderWidth: 1, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  resumeWrap: { position: "absolute", left: 0, right: 0, bottom: 92, alignItems: "center" },
  resumePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  resumeText: { ...dtype.cardTitle, fontSize: 14 },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  likeCount: { ...dtype.meta, fontWeight: "700" },

  title: { ...dtype.titleL, marginBottom: 12 },

  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  tagChip: { borderRadius: 8, paddingHorizontal: 9, paddingVertical: 4 },
  tagText: { ...dtype.meta, fontWeight: "600" },

  source: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sourceText: { ...dtype.bodyS, flex: 1 },

  sourceLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  sourceLinkText: { ...dtype.cardTitle },

  article: { gap: 16 },
  paragraph: { ...dtype.body, lineHeight: 26 },

  tabs: { flexDirection: "row", borderWidth: 1, borderRadius: 12, padding: 3, marginBottom: 16, gap: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  tabText: { ...dtype.cardTitle, fontSize: 14 },

  originalWrap: { gap: 22 },
  ai: { gap: 14 },
  aiModes: { flexDirection: "row", gap: 8 },
  aiMode: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  aiModeText: { ...dtype.label, fontSize: 12.5 },
  aiLoading: { alignItems: "center", gap: 8, paddingVertical: 24 },
  aiHint: { ...dtype.bodyS },
  aiText: { ...dtype.body, lineHeight: 25 },
  aiRun: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  aiRunText: { ...dtype.cardTitle },

  aiCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  aiCardHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  aiNum: { width: 24, height: 24, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  aiNumText: { fontSize: 13, fontWeight: "800" },
  aiCardTitle: { ...dtype.cardTitle, flex: 1 },
  aiCardBody: { ...dtype.body, lineHeight: 24 },
  aiExplain: { borderWidth: 1, borderRadius: 12, paddingVertical: 12, alignItems: "center" },
  aiExplainText: { ...dtype.cardTitle, fontSize: 14 },

  opinions: { marginTop: 28, gap: 12 },
  opinionsTitle: { ...dtype.title },
  opinionCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  opinionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  opinionWho: { ...dtype.cardTitle },
  opinionCore: { ...dtype.body, fontWeight: "600" },
  opinionField: { ...dtype.bodyS },
  opinionMore: { ...dtype.cardTitle, paddingVertical: 6 },
  opinionExpand: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, alignSelf: "flex-start" },
  opinionExpandText: { ...dtype.label, fontSize: 13 },
  opinionsEmpty: { paddingVertical: 40, alignItems: "center" },
  opinionsEmptyText: { ...dtype.body, textAlign: "center", lineHeight: 23 },

  backWrap: { position: "absolute", top: 0, left: 0, paddingHorizontal: 12, paddingTop: 4 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  ctaWrap: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 8 },
  cta: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  ctaText: { ...dtype.cardTitle },
});
