// distill 기업(브랜드) 홈 — 홈의 서비스 로고/캐러셀 헤더 탭으로 진입.
//   피드와 다르게: [브랜드 히어로 + 즐겨찾기] · [인기글 큐레이션 캐러셀] · [주제별 최신글].
import React, { useMemo, useState } from "react";
import { Dimensions, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { Check, ChevronDown, ChevronLeft, Star, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import {
  useArticlesFeed,
  useArticlesFeedCount,
  useBlogTopics,
  useBlogs,
  useFavoriteBlogIds,
  useToggleBlogFavorite,
} from "@/data";
import { dtype, TOPIC_META, TOPIC_ORDER } from "@/theme";
import type { Topic } from "@/types/database";
import { ArticleCardH, ArticleRow, ServiceLogo } from "@/components/distill/ArticleCards";
import { Loading, ErrorState, EmptyState } from "@/components";

type Props = NativeStackScreenProps<RootStackParamList, "BlogArticles">;

const W = Dimensions.get("window").width;
const CURATION_W = Math.round(W * 0.6);

export function BlogArticlesScreen({ route }: Props) {
  const { blogId, blogName } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [switchOpen, setSwitchOpen] = useState(false);

  const allBlogs = useBlogs().data ?? [];
  const blog = allBlogs.find((b) => b.id === blogId);
  const favIds = useFavoriteBlogIds();
  const toggleFav = useToggleBlogFavorite();
  const isFav = useMemo(() => new Set(favIds.data ?? []).has(blogId), [favIds.data, blogId]);

  const topicsQ = useBlogTopics(blogId);
  const available = TOPIC_ORDER.filter((t) => (topicsQ.data ?? []).includes(t));

  const countQ = useArticlesFeedCount({ blogId });
  const popularQ = useArticlesFeed({ blogId, sort: "popular" });
  const popular = (popularQ.data?.pages[0]?.rows ?? []).slice(0, 10);

  const q = useArticlesFeed({ blogId, topic: topic ?? undefined });
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      {/* 헤더 — 기업명 셀렉트로 다른 기업 전환 */}
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.backBtn}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <Pressable style={styles.headerSelect} onPress={() => setSwitchOpen(true)}>
          <Text style={[styles.headerSelectText, { color: c.textPrimary }]} numberOfLines={1}>
            {blogName}
          </Text>
          <ChevronDown size={18} color={c.textMuted} />
        </Pressable>
        <View style={styles.backBtn} />
      </View>

      {/* 기업 전환 — 바텀시트 */}
      <Modal visible={switchOpen} transparent animationType="slide" onRequestClose={() => setSwitchOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSwitchOpen(false)}>
          <Pressable style={[styles.switchPanel, { backgroundColor: c.surfaceCard }]} onPress={() => {}}>
            <View style={styles.grip}>
              <View style={[styles.gripBar, { backgroundColor: c.hairline }]} />
            </View>
            <View style={styles.switchHead}>
              <Text style={[styles.switchTitle, { color: c.textPrimary }]}>어떤 기업을 볼까요?</Text>
              <Pressable onPress={() => setSwitchOpen(false)} hitSlop={8}>
                <X size={20} color={c.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {allBlogs.map((b) => {
                const on = b.id === blogId;
                return (
                  <Pressable
                    key={b.id}
                    style={styles.switchRow}
                    onPress={() => {
                      setSwitchOpen(false);
                      if (!on) nav.replace("BlogArticles", { blogId: b.id, blogName: b.name });
                    }}
                  >
                    <ServiceLogo name={b.name} brandColor={b.brand_color} homepage={b.homepage} blogKey={b.key} size={30} />
                    <Text style={[styles.switchName, { color: on ? c.primary : c.textPrimary }]}>{b.name}</Text>
                    {on ? <Check size={20} color={c.primary} /> : null}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

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
          if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
        }}
        ListEmptyComponent={
          q.isLoading ? (
            <Loading label="불러오는 중…" />
          ) : q.isError ? (
            <ErrorState onRetry={() => q.refetch()} />
          ) : (
            <EmptyState title="글이 없어요" hint={topic ? "다른 카테고리를 골라보세요" : undefined} />
          )
        }
        ListHeaderComponent={
          <View>
            {/* 브랜드 히어로 + 즐겨찾기 */}
            <View style={styles.hero}>
              <ServiceLogo
                name={blogName}
                brandColor={blog?.brand_color}
                homepage={blog?.homepage}
                blogKey={blog?.key}
                size={56}
              />
              <View style={{ flex: 1 }}>
                <Text style={[styles.brandName, { color: c.textPrimary }]} numberOfLines={1}>
                  {blogName}
                </Text>
                <Text style={[styles.brandMeta, { color: c.textMuted }]}>
                  글 {countQ.data != null ? countQ.data.toLocaleString() : "-"}개
                </Text>
              </View>
              <Pressable
                onPress={() => toggleFav.mutate({ blogId, favorite: !isFav })}
                disabled={toggleFav.isPending}
                style={[
                  styles.favBtn,
                  { backgroundColor: isFav ? c.primaryTint : c.surfaceCard, borderColor: isFav ? c.primary : c.hairline },
                ]}
              >
                <Star size={16} color={isFav ? c.hot : c.textMuted} fill={isFav ? c.hot : "transparent"} />
                <Text style={[styles.favText, { color: isFav ? c.primary : c.textSecondary }]}>
                  {isFav ? "즐겨찾는 중" : "즐겨찾기"}
                </Text>
              </Pressable>
            </View>

            {/* 인기글 큐레이션 */}
            {popular.length > 0 ? (
              <View style={styles.curation}>
                <Text style={[styles.sectionLabel, { color: c.textPrimary }]}>이 기업 인기글</Text>
                <FlatList
                  data={popular}
                  keyExtractor={(a) => a.id}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  snapToInterval={CURATION_W + 12}
                  decelerationRate="fast"
                  contentContainerStyle={styles.curationRow}
                  renderItem={({ item }) => (
                    <ArticleCardH
                      article={item}
                      width={CURATION_W}
                      onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })}
                    />
                  )}
                />
              </View>
            ) : null}

            {/* 주제별 최신 */}
            <Text style={[styles.sectionLabel, { color: c.textPrimary, marginTop: 8 }]}>최신글</Text>
            {available.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chips}
              >
                <Chip label="전체" active={topic === null} onPress={() => setTopic(null)} />
                {available.map((t) => (
                  <Chip
                    key={t}
                    label={TOPIC_META[t].label}
                    active={topic === t}
                    onPress={() => setTopic(topic === t ? null : t)}
                  />
                ))}
              </ScrollView>
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? c.primary : c.surfaceSunken, borderColor: active ? c.primary : c.hairline },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? c.actionOn : c.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 8 },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerSelect: { flexDirection: "row", alignItems: "center", gap: 4, flex: 1, justifyContent: "center" },
  headerSelectText: { ...dtype.title, maxWidth: W * 0.6 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  switchPanel: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 30,
  },
  grip: { alignItems: "center", paddingTop: 10, paddingBottom: 4 },
  gripBar: { width: 40, height: 4, borderRadius: 2 },
  switchHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  switchTitle: { ...dtype.title },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  switchName: { ...dtype.body, flex: 1 },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  hero: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 8 },
  brandName: { ...dtype.titleL },
  brandMeta: { ...dtype.meta, marginTop: 3 },
  favBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  favText: { ...dtype.label, fontSize: 12.5 },

  curation: { marginTop: 12, marginHorizontal: -16 },
  curationRow: { paddingHorizontal: 16, gap: 12, paddingTop: 8 },
  sectionLabel: { ...dtype.title, marginBottom: 2 },

  chips: { paddingVertical: 10, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, borderWidth: 1 },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: "700" },

  sep: { height: 1 },
});
