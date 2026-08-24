// distill 인사이트 탭 (회의록 2026-08-18 §인사이트) — [인사이트 / 커뮤니티] 2탭.
//   인사이트: 사람들의 독후감(의견) 모아보기(기업·주제·정렬 필터).
//   커뮤니티: 자유글. 글쓰기 FAB는 커뮤니티에만.
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { PenLine, Search } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useOpinionsFeed, useBlogs, useCommunityPosts, type OpinionSort } from "@/data";
import { dtype, TOPIC_META, TOPIC_ORDER } from "@/theme";
import type { Topic } from "@/types/database";
import type { CommunityPost } from "@/data/community";
import { OpinionCard } from "@/components/distill/OpinionCard";
import { BlogDropdown } from "@/components/distill/BlogDropdown";
import { relativeDate } from "@/components/distill/ArticleCards";
import { Avatar } from "@/components/Avatar";
import { Loading, ErrorState, EmptyState } from "@/components";

type MainTab = "insight" | "community";

export function DiscussScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();

  const [mainTab, setMainTab] = useState<MainTab>("insight");
  const [sort, setSort] = useState<OpinionSort>("latest");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [blogSel, setBlogSel] = useState<Set<string>>(new Set());

  const blogsQ = useBlogs();
  const q = useOpinionsFeed(sort);
  const list = q.data ?? [];
  const communityQ = useCommunityPosts();

  const filtered = useMemo(() => {
    return list.filter((o) => {
      if (topic && o.article?.topic !== topic) return false;
      if (blogSel.size > 0 && !blogSel.has(o.article?.blog?.id ?? "")) return false;
      return true;
    });
  }, [list, topic, blogSel]);

  const countLabel = `${filtered.length.toLocaleString()}개`;

  const toggleBlog = (id: string) =>
    setBlogSel((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
          {/* 기업 드롭다운(피드와 동일) */}
          <BlogDropdown
            blogs={blogsQ.data ?? []}
            selected={blogSel}
            onToggle={toggleBlog}
            onClear={() => setBlogSel(new Set())}
          />

          {/* 주제 칩 */}
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

          {/* 개수(좌) + 정렬(우) */}
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
          ) : filtered.length === 0 ? (
            <EmptyState title="아직 의견이 없어요" hint="글을 읽고 첫 의견을 남겨보세요" />
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
              renderItem={({ item }) => <CommunityCard post={item} />}
              contentContainerStyle={styles.listContent}
              ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
              showsVerticalScrollIndicator={false}
              refreshing={communityQ.isRefetching}
              onRefresh={() => communityQ.refetch()}
            />
          )}

          {/* 글쓰기 FAB — 커뮤니티 전용 */}
          <Pressable
            onPress={() => nav.navigate("CreateCommunityPost")}
            style={({ pressed }) => [styles.fab, { backgroundColor: c.primary, opacity: pressed ? 0.9 : 1 }]}
            hitSlop={8}
          >
            <PenLine size={24} color="#fff" />
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

function CommunityCard({ post }: { post: CommunityPost }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.cCard, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
      <View style={styles.cHead}>
        <Avatar name={post.author?.name ?? "게스트"} size={28} />
        <Text style={[styles.cAuthor, { color: c.textSecondary }]}>{post.author?.name ?? "게스트"}</Text>
        <Text style={[styles.cDate, { color: c.textMuted }]}>{relativeDate(post.created_at)}</Text>
      </View>
      <Text style={[styles.cTitle, { color: c.textPrimary }]} numberOfLines={2}>
        {post.title}
      </Text>
      <Text style={[styles.cBody, { color: c.textSecondary }]} numberOfLines={3}>
        {post.body}
      </Text>
    </View>
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
    paddingBottom: 4,
  },
  title: { ...dtype.display },
  searchUtil: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },

  mainTabs: { flexDirection: "row", borderBottomWidth: 1, marginBottom: 4 },
  mainTab: { flex: 1, alignItems: "center", paddingVertical: 12 },
  mainTabText: { ...dtype.cardTitle, fontSize: 15 },
  mainTabBar: { position: "absolute", bottom: -1, height: 2, left: "25%", right: "25%", borderRadius: 2 },

  sortSeg: { flexDirection: "row", borderRadius: 10, padding: 3, gap: 2 },
  sortBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  sortBtnText: { ...dtype.label, fontSize: 12.5, fontWeight: "700" },

  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 2,
    paddingBottom: 8,
  },
  countText: { ...dtype.label, fontSize: 13, fontWeight: "700" },

  chips: { paddingHorizontal: 16, paddingVertical: 8, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1 },
  chipText: { ...dtype.label, fontSize: 13 },

  listContent: { paddingHorizontal: 16, paddingVertical: 12, paddingBottom: 32 },

  cCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  cHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  cAuthor: { ...dtype.label, fontSize: 13, flex: 1 },
  cDate: { ...dtype.meta },
  cTitle: { ...dtype.cardTitle, fontSize: 15 },
  cBody: { ...dtype.bodyS, lineHeight: 20 },

  fab: {
    position: "absolute",
    right: 18,
    bottom: 22,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.22,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
