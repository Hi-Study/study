// distill 인사이트 탭 (회의록 2026-08-18 §인사이트) — [인사이트 / 커뮤니티] 2탭.
//   인사이트: 사람들의 독후감(의견) 모아보기(기업·주제·정렬 필터).
//   커뮤니티: 자유글. 글쓰기 FAB는 커뮤니티에만.
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FileText, Link2, PenLine, Search, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useOpinionsFeed, useBlogs, useCommunityPosts } from "@/data";
import { dtype , PRETENDARD} from "@/theme";
import { OpinionCard } from "@/components/distill/OpinionCard";
import { CommunityCard } from "@/components/distill/CommunityCard";
import { FilterSheet, emptyFilter, type FilterValue } from "@/components/distill/FilterSheet";
import { Loading, ErrorState, EmptyState } from "@/components";

type MainTab = "insight" | "community";

export function DiscussScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();

  const [mainTab, setMainTab] = useState<MainTab>("insight");
  const [writeOpen, setWriteOpen] = useState(false);
  const [filter, setFilter] = useState<FilterValue>(emptyFilter);
  // 커뮤니티 자유글엔 기업·주제가 없다(테이블에 컬럼 자체가 없음) — 고를 건 정렬뿐이라
  //   같은 칩 UI 를 정렬 하나로만 쓴다. "popular" 는 자유글에선 "이야기 많은 순"(active).
  const [communityFilter, setCommunityFilter] = useState<FilterValue>(emptyFilter);

  const blogsQ = useBlogs();
  const q = useOpinionsFeed(filter.sort);
  const list = q.data ?? [];
  const communityQ = useCommunityPosts(communityFilter.sort === "popular" ? "active" : "latest");

  const filtered = useMemo(() => {
    return list.filter((o) => {
      if (filter.topics.size > 0 && !(o.article?.topic && filter.topics.has(o.article.topic))) return false;
      if (filter.blogIds.size > 0 && !filter.blogIds.has(o.article?.blog?.id ?? "")) return false;
      return true;
    });
  }, [list, filter.topics, filter.blogIds]);

  const countLabel = `${filtered.length.toLocaleString()}개`;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      {/* 헤더: 제목 + 검색 유틸 */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.textPrimary }]}>인사이트</Text>
        <Pressable hitSlop={8} style={styles.searchUtil} onPress={() => nav.navigate("Search")}>
          <Search size={22} color={c.textSecondary} />
        </Pressable>
      </View>

      {/* 인사이트 / 커뮤니티 서브탭 */}
      <View style={[styles.mainTabs, { borderBottomColor: c.hairline }]}>
        {(["insight", "community"] as const).map((t) => {
          const on = mainTab === t;
          return (
            <Pressable key={t} style={styles.mainTab} onPress={() => setMainTab(t)}>
              <Text style={[styles.mainTabText, { color: on ? c.primary : c.textMuted }]}>
                {t === "insight" ? "인사이트" : "커뮤니티"}
              </Text>
              {on ? <View style={[styles.mainTabBar, { backgroundColor: c.primary }]} /> : null}
            </Pressable>
          );
        })}
      </View>

      {mainTab === "insight" ? (
        <>
          {/* ⚠️ 여기서는 히어로(큰 기업 이름 + 인사 배너)를 쓰지 않는다.
              인사이트 탭은 위에 이미 [인사이트/커뮤니티] 서브탭이 있어서, 그 밑에 또 큰
              제목이 오면 화면에 제일 큰 글씨가 두 개가 된다(DESIGN_SYSTEM §0.1).
              **기업·카테고리·정렬을 같은 모양의 드롭다운 칩 3개**로 나란히 둔다. */}
          <FilterSheet
            blogs={blogsQ.data ?? []}
            value={filter}
            onChange={setFilter}
            variant="chips"
          />

          {/* 개수 */}
          <View style={styles.filterRow}>
            <Text style={[styles.countText, { color: c.textSecondary }]}>{countLabel}</Text>
          </View>

          {q.isLoading ? (
            <Loading label="불러오는 중…" />
          ) : q.isError ? (
            <ErrorState onRetry={() => q.refetch()} />
          ) : filtered.length === 0 ? (
            <EmptyState title="아직 인사이트가 없어요" hint="글을 읽고 첫 인사이트를 남겨보세요" />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(o) => o.id}
              renderItem={({ item }) => (
                <OpinionCard
                  opinion={item}
                  onPress={() =>
                    item.article
                      ? nav.navigate("ArticleDetail", { articleId: item.article.id, focusOpinionId: item.id })
                      : nav.navigate("OpinionDetail", { opinionId: item.id })
                  }
                  onAuthorPress={
                    item.author_id
                      ? () => nav.navigate("InsighterProfile", { userId: item.author_id! })
                      : undefined
                  }
                />
              )}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              showsVerticalScrollIndicator={false}
              refreshing={q.isRefetching}
              onRefresh={() => q.refetch()}
            />
          )}
        </>
      ) : (
        <>
          <FilterSheet
            blogs={[]}
            value={communityFilter}
            onChange={setCommunityFilter}
            variant="sort"
            sortLabels={{ latest: "최신순", popular: "이야기 많은 순" }}
          />

          <View style={styles.filterRow}>
            <Text style={[styles.countText, { color: c.textSecondary }]}>
              {(communityQ.data ?? []).length.toLocaleString()}개
            </Text>
          </View>

          {communityQ.isLoading ? (
            <Loading label="불러오는 중…" />
          ) : communityQ.isError ? (
            <ErrorState onRetry={() => communityQ.refetch()} />
          ) : (communityQ.data ?? []).length === 0 ? (
            <EmptyState title="아직 글이 없어요" hint="오른쪽 아래 버튼으로 첫 자유글을 남겨보세요" />
          ) : (
            <FlatList
              data={communityQ.data ?? []}
              keyExtractor={(p) => p.id}
              renderItem={({ item }) => (
                <CommunityCard
                  post={item}
                  onPress={() => nav.navigate("CommunityPostDetail", { postId: item.id })}
                />
              )}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              showsVerticalScrollIndicator={false}
              refreshing={communityQ.isRefetching}
              onRefresh={() => communityQ.refetch()}
            />
          )}

          {/* 글쓰기 FAB — 커뮤니티 전용. 2가지 방식 선택 */}
          <Pressable
            onPress={() => setWriteOpen(true)}
            style={({ pressed }) => [styles.fab, { backgroundColor: c.primary, opacity: pressed ? 0.9 : 1 }]}
            hitSlop={8}
          >
            <PenLine size={24} color="#fff" />
          </Pressable>

          {/* 글쓰기 방식 선택 시트 */}
          <Modal visible={writeOpen} transparent animationType="slide" onRequestClose={() => setWriteOpen(false)}>
            <Pressable style={styles.wBackdrop} onPress={() => setWriteOpen(false)}>
              <Pressable style={[styles.wSheet, { backgroundColor: c.surfaceCard }]} onPress={() => {}}>
                <View style={styles.wHead}>
                  <Text style={[styles.wTitle, { color: c.textPrimary }]}>어떤 글을 쓸까요?</Text>
                  <Pressable onPress={() => setWriteOpen(false)} hitSlop={8}>
                    <X size={20} color={c.textMuted} />
                  </Pressable>
                </View>

                <Pressable
                  style={[styles.wOpt, { borderColor: c.hairline }]}
                  onPress={() => {
                    setWriteOpen(false);
                    nav.navigate("CreateArticle");
                  }}
                >
                  <View style={[styles.wIcon, { backgroundColor: c.primaryTint }]}>
                    <Link2 size={20} color={c.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.wOptTitle, { color: c.textPrimary }]}>인사이트 공유</Text>
                    <Text style={[styles.wOptSub, { color: c.textMuted }]}>URL 링크 + 독후감 항목을 채워서</Text>
                  </View>
                </Pressable>

                <Pressable
                  style={[styles.wOpt, { borderColor: c.hairline }]}
                  onPress={() => {
                    setWriteOpen(false);
                    nav.navigate("CreateCommunityPost");
                  }}
                >
                  <View style={[styles.wIcon, { backgroundColor: c.surfaceSunken }]}>
                    <FileText size={20} color={c.textSecondary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.wOptTitle, { color: c.textPrimary }]}>자유글</Text>
                    <Text style={[styles.wOptSub, { color: c.textMuted }]}>제목과 내용만 자유롭게</Text>
                  </View>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )}
    </SafeAreaView>
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
    paddingBottom: 4,
  },
  // 화면 제목은 한 단계 낮춰서, "기업 드롭다운"이 화면에서 제일 큰 요소가 되게 한다.
  title: { ...dtype.title },
  searchUtil: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },

  mainTabs: { flexDirection: "row", borderBottomWidth: 1, marginBottom: 8 },
  mainTab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  mainTabText: { ...dtype.cardTitle },
  mainTabBar: { position: "absolute", bottom: -1, height: 2, left: "25%", right: "25%", borderRadius: 2 },

  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  countText: { ...dtype.label },

  listContent: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 32 },

  fab: {
    position: "absolute",
    right: 18,
    bottom: 22,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    // DESIGN_SYSTEM §3 그림자 스펙 그대로(0.18 / 12 / (0,6) / elevation 8).
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },

  wBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  wSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, gap: 12 },
  wHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2 },
  wTitle: { ...dtype.title },
  wOpt: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
  },
  wIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  wOptTitle: { ...dtype.cardTitle },
  wOptSub: { ...dtype.bodyS, marginTop: 2 },
});
