// distill 피드 탭 — 주제별 테크 글 스트림 (회의록 §피드).
// 정보 과다 완화: 주제 탭 + [정렬 · 기업 필터] 한 줄 + 리스트/그리드 보기 토글.
import React, { useMemo, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Building2, Check, ChevronDown, LayoutGrid, Rows3, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useArticlesFeed, useArticlesFeedCount, useBlogs } from "@/data";
import { dtype, TOPIC_META, TOPIC_ORDER } from "@/theme";
import type { Topic } from "@/types/database";
import { ArticleRow, ArticleGridCard, ServiceLogo } from "@/components/distill/ArticleCards";
import { Loading, ErrorState, EmptyState } from "@/components";

const W = Dimensions.get("window").width;
const GRID_GAP = 12;
const GRID_CARD_W = Math.floor((W - 32 - GRID_GAP) / 2); // 좌우 16 패딩 + 카드 사이 간격

type ViewMode = "list" | "grid";

export function FeedScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [topic, setTopic] = useState<Topic | null>(null);
  const [sort, setSort] = useState<"latest" | "popular">("latest");
  const [view, setView] = useState<ViewMode>("list");
  const [blogSel, setBlogSel] = useState<Set<string>>(new Set());
  const [filterOpen, setFilterOpen] = useState(false);

  const blogsQ = useBlogs();
  const blogIds = useMemo(() => [...blogSel], [blogSel]);
  // 정렬 무관한 기본 필터(주제+기업) — 피드와 개수 쿼리가 공유. 정렬 토글 시 개수는 재요청 안 함.
  const baseFilter = useMemo(
    () => ({ ...(topic ? { topic } : {}), ...(blogIds.length > 0 ? { blogIds } : {}) }),
    [topic, blogIds],
  );
  const q = useArticlesFeed({ ...baseFilter, sort });
  const countQ = useArticlesFeedCount(baseFilter);
  const rows = q.data?.pages.flatMap((p) => p.rows) ?? [];

  // 드롭다운 요약(전체 / 기업명 / OO 외 N개) + 글 개수(더 있으면 '+').
  const selectedNames = (blogsQ.data ?? []).filter((b) => blogSel.has(b.id)).map((b) => b.name);
  const blogSummary =
    selectedNames.length === 0
      ? "전체"
      : selectedNames.length === 1
        ? selectedNames[0]
        : `${selectedNames[0]} 외 ${selectedNames.length - 1}개`;
  const countLabel = countQ.data != null ? `${countQ.data.toLocaleString()}개` : "";

  const toggleBlog = (id: string) =>
    setBlogSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      {/* 제목 + 리스트/그리드 토글 */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.textPrimary }]}>피드</Text>
        <View style={[styles.viewSeg, { backgroundColor: c.surfaceSunken }]}>
          {(["list", "grid"] as const).map((v) => {
            const on = view === v;
            const Icon = v === "list" ? Rows3 : LayoutGrid;
            return (
              <Pressable
                key={v}
                onPress={() => setView(v)}
                style={[styles.viewBtn, on && { backgroundColor: c.surfaceCard }]}
                hitSlop={4}
              >
                <Icon size={17} color={on ? c.primary : c.textMuted} />
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* 기업 드롭다운 — 최상단, 기본 '전체' */}
      <Pressable
        onPress={() => setFilterOpen(true)}
        style={[
          styles.blogDropdown,
          { backgroundColor: c.surfaceCard, borderColor: blogSel.size > 0 ? c.primary : c.hairline },
        ]}
      >
        <Building2 size={16} color={blogSel.size > 0 ? c.primary : c.textSecondary} />
        <Text style={[styles.blogDropdownLabel, { color: c.textMuted }]}>기업</Text>
        <Text
          style={[styles.blogDropdownValue, { color: blogSel.size > 0 ? c.primary : c.textPrimary }]}
          numberOfLines={1}
        >
          {blogSummary}
        </Text>
        <ChevronDown size={18} color={c.textMuted} />
      </Pressable>

      {/* 주제 탭 */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <Chip label="전체" active={topic === null} onPress={() => setTopic(null)} />
        {TOPIC_ORDER.map((t) => (
          <Chip
            key={t}
            label={TOPIC_META[t].label}
            active={topic === t}
            onPress={() => setTopic(topic === t ? null : t)}
          />
        ))}
      </ScrollView>

      {/* 글 개수(좌) + 정렬(우) */}
      <View style={styles.filterRow}>
        <Text style={[styles.countText, { color: c.textSecondary }]}>{countLabel}</Text>

        <View style={[styles.sortSeg, { backgroundColor: c.surfaceSunken }]}>
          {(["latest", "popular"] as const).map((s) => {
            const on = sort === s;
            return (
              <Pressable
                key={s}
                onPress={() => setSort(s)}
                style={[styles.sortBtn, on && { backgroundColor: c.surfaceCard }]}
              >
                <Text style={[styles.sortBtnText, { color: on ? c.primary : c.textMuted }]}>
                  {s === "latest" ? "최신순" : "인기순"}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {q.isLoading ? (
        <Loading label="불러오는 중…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="글이 없어요" hint="주제·기업 필터를 바꿔보세요" />
      ) : (
        <FlatList
          key={view} /* numColumns 변경 시 리마운트 필요 */
          data={rows}
          keyExtractor={(a) => a.id}
          numColumns={view === "grid" ? 2 : 1}
          columnWrapperStyle={view === "grid" ? styles.gridRow : undefined}
          renderItem={({ item }) =>
            view === "grid" ? (
              <ArticleGridCard
                article={item}
                width={GRID_CARD_W}
                onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })}
              />
            ) : (
              <ArticleRow
                article={item}
                onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })}
              />
            )
          }
          ItemSeparatorComponent={
            view === "list" ? () => <View style={[styles.sep, { backgroundColor: c.hairline }]} /> : undefined
          }
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onEndReachedThreshold={0.5}
          onEndReached={() => {
            if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
          }}
        />
      )}

      {/* 기업 필터 시트 */}
      <Modal visible={filterOpen} transparent animationType="slide" onRequestClose={() => setFilterOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setFilterOpen(false)}>
          <Pressable style={[styles.sheet, { backgroundColor: c.surfaceCard }]} onPress={() => {}}>
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: c.textPrimary }]}>기업 선택</Text>
              <View style={styles.sheetHeadRight}>
                {blogSel.size > 0 ? (
                  <Pressable onPress={() => setBlogSel(new Set())} hitSlop={8}>
                    <Text style={[styles.sheetReset, { color: c.primary }]}>초기화</Text>
                  </Pressable>
                ) : null}
                <Pressable onPress={() => setFilterOpen(false)} hitSlop={8}>
                  <X size={20} color={c.textMuted} />
                </Pressable>
              </View>
            </View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {(blogsQ.data ?? []).map((b) => {
                const on = blogSel.has(b.id);
                return (
                  <Pressable key={b.id} style={styles.sheetRow} onPress={() => toggleBlog(b.id)}>
                    <ServiceLogo
                      name={b.name}
                      brandColor={b.brand_color}
                      homepage={b.homepage}
                      blogKey={b.key}
                      size={30}
                    />
                    <Text style={[styles.sheetName, { color: c.textPrimary }]}>{b.name}</Text>
                    {on ? (
                      <Check size={20} color={c.primary} />
                    ) : (
                      <View style={[styles.emptyCheck, { borderColor: c.hairline }]} />
                    )}
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable
              style={[styles.applyBtn, { backgroundColor: c.primary }]}
              onPress={() => setFilterOpen(false)}
            >
              <Text style={[styles.applyText, { color: c.actionOn }]}>
                {blogSel.size > 0 ? `${blogSel.size}개 기업 보기` : "전체 보기"}
              </Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
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
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 8,
  },
  title: { ...dtype.display },
  viewSeg: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  viewBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },

  chips: { paddingHorizontal: 16, paddingVertical: 6, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { ...dtype.label, fontSize: 13 },

  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 10,
  },
  sortSeg: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  sortBtnText: { ...dtype.label, fontSize: 12.5, fontWeight: "700" },
  countText: { ...dtype.label, fontSize: 13, fontWeight: "700" },

  blogDropdown: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginHorizontal: 16,
    marginTop: 2,
    marginBottom: 4,
  },
  blogDropdownLabel: { ...dtype.label, fontSize: 12.5 },
  blogDropdownValue: { ...dtype.body, fontSize: 14, fontWeight: "700", flex: 1 },

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  gridRow: { gap: GRID_GAP, marginBottom: GRID_GAP },
  sep: { height: 1 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 30, gap: 6 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 },
  sheetHeadRight: { flexDirection: "row", alignItems: "center", gap: 16 },
  sheetTitle: { ...dtype.title },
  sheetReset: { ...dtype.label, fontSize: 13 },
  sheetRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  sheetName: { ...dtype.body, flex: 1 },
  emptyCheck: { width: 20, height: 20, borderRadius: 10, borderWidth: 1.5 },
  applyBtn: { marginTop: 10, borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  applyText: { ...dtype.cardTitle },
});
