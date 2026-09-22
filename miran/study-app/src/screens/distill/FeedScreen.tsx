/**
 * distill 피드 탭 — 전체 글 목록.
 *
 * 머리를 **가볍게** 바꿨다. 예전엔 큰 기업 드롭다운 + 인사 배너(히어로)가 화면 위쪽을
 * 절반 가까이 차지해서, 작은 폰에서 글이 두세 줄밖에 안 보였다.
 * 목록 화면의 일은 "글을 많이 보여주는 것"이라, 필터는 칩 한 줄로 접었다.
 *   [피드 🔍] → [기업][카테고리][난이도][정렬] 칩 → [N개 · 안 읽은 글만] → 리스트
 */
import React, { useEffect, useMemo, useRef, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowUp, Search, X } from "lucide-react-native";
import {
  SERVICE_KIND_META,
  serviceKindOf,
  type ServiceKind,
} from "@/lib/serviceKind";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useArticlesFeed, useArticlesFeedCount, useBlogs, useReadIds } from "@/data";
import { dtype } from "@/theme";
import type { Topic } from "@/types/database";
import { ArticleRow } from "@/components/distill/ArticleCards";
import type { ArticleWithBlog } from "@/data/articles";
import { FilterSheet, emptyFilter, type FilterValue } from "@/components/distill/FilterSheet";
import { Loading, ErrorState, EmptyState } from "@/components";

/**
 * 필터별 마지막 스크롤 위치.
 *
 * 컴포넌트 밖에 두는 이유: 탭을 옮기거나 화면이 언마운트돼도 값이 남아야 한다.
 * state 에 두면 언마운트와 함께 사라지고, ref 에 두면 같은 이유로 사라진다.
 * 필터가 다르면 다른 목록이므로 **필터마다 따로** 기억한다.
 */
const lastOffset = new Map<string, number>();

/** 이 높이를 넘겨 내려가면 "맨 위로"를 띄운다. 한 화면(대략 700)보다 조금 더. */
const TOP_BTN_AT = 800;

export function FeedScreen({
  route,
}: {
  route?: { params?: { topic?: Topic; purpose?: string; service?: ServiceKind } };
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  /**
   * 홈의 대분류에서 들어오면 그 주제가 **켜진 채로** 시작한다.
   * ⚠️ lazy initializer 로 한 번만 읽는다 — 매 렌더 새 Set 을 만들면 쿼리 키가 갈라진다.
   */
  const initialTopic = route?.params?.topic;
  const [filter, setFilter] = useState<FilterValue>(() => {
    const base = emptyFilter();
    if (initialTopic) base.topics = new Set([initialTopic]);
    return base;
  });

  // 다른 대분류로 다시 들어오면 필터를 갈아끼운다(탭이 살아 있어 state 가 유지되므로).
  useEffect(() => {
    if (!initialTopic) return;
    setFilter((p) => (p.topics.has(initialTopic) && p.topics.size === 1 ? p : { ...p, topics: new Set([initialTopic]) }));
  }, [initialTopic]);

  /**
   * 목적 태그 — 홈의 "이런 걸 풀었어요"에서 들어온다.
   * 대분류 칩(FilterSheet)과 섞지 않고 **따로 둔다**: 대분류는 "결론이 무엇인가",
   * 목적은 "무엇을 이루려 했나"라 같은 줄에 놓으면 둘을 같은 종류로 읽는다.
   */
  const [purpose, setPurpose] = useState<string | undefined>(route?.params?.purpose);
  useEffect(() => setPurpose(route?.params?.purpose), [route?.params?.purpose]);

  /**
   * 안 읽은 글만 보기 — 서버 필터가 아니라 **받아온 목록에서 걸러낸다.**
   *   읽음 기록(article_reads)은 내 것이고 글 목록은 공용 쿼리라, 서버에서 섞으면
   *   사람마다 캐시가 갈라져 페이지네이션이 어긋난다. 걸러낸 만큼 한 페이지가 짧아지는 건
   *   감수한다 — 스크롤하면 다음 페이지가 이어서 붙는다.
   */
  const [unreadOnly, setUnreadOnly] = useState(false);
  const readIdsQ = useReadIds();

  const blogsQ = useBlogs();

  /**
   * 서비스 종류(커머스·금융·포털…) — 홈의 "비슷한 서비스는 어떻게 했을까요?"에서 들어온다.
   * 종류는 DB 컬럼이 아니라 `serviceKind.ts` 의 표라, **여기서 기업 id 목록으로 풀어** 넘긴다.
   */
  const [service, setService] = useState<ServiceKind | undefined>(route?.params?.service);
  useEffect(() => setService(route?.params?.service), [route?.params?.service]);
  /**
   * 서비스 종류 → 기업 id 목록.
   * 종류는 DB 컬럼이 아니라 `serviceKind.ts` 의 표라, **여기서 풀어** 서버 필터에 넘긴다.
   * 홈에서 넘어온 `service` 파라미터와 필터 시트에서 고른 것을 합쳐서 본다.
   */
  const serviceBlogIds = useMemo(() => {
    const kinds = new Set(filter.services);
    if (service) kinds.add(service);
    if (kinds.size === 0) return [];
    return (blogsQ.data ?? [])
      .filter((b) => kinds.has(serviceKindOf(b.key)))
      .map((b) => b.id);
  }, [service, filter.services, blogsQ.data]);
  const baseFilter = useMemo(
    () => ({
      ...(filter.topics.size > 0 ? { topics: [...filter.topics] } : {}),
      // 기업을 직접 고른 게 있으면 그쪽이 이긴다. 둘을 교집합으로 걸면
      // "커머스 + 토스" 처럼 서로 맞물리지 않는 조합에서 결과가 0건이 된다.
      ...(filter.blogIds.size > 0
        ? { blogIds: [...filter.blogIds] }
        : serviceBlogIds.length > 0
          ? { blogIds: serviceBlogIds }
          : {}),
      ...(filter.levels.size > 0 ? { levels: [...filter.levels] } : {}),
      ...(purpose ? { purpose } : {}),
    }),
    [filter.topics, filter.blogIds, filter.levels, purpose, serviceBlogIds],
  );
  const q = useArticlesFeed({ ...baseFilter, sort: filter.sort });
  const countQ = useArticlesFeedCount(baseFilter);
  const all = q.data?.pages.flatMap((p) => p.rows) ?? [];
  const readSet = useMemo(() => new Set(readIdsQ.data ?? []), [readIdsQ.data]);
  const rows = unreadOnly ? all.filter((a) => !readSet.has(a.id)) : all;
  const countLabel = countQ.data != null ? `${countQ.data.toLocaleString()}개` : "";

  // ── 스크롤 — 위치 복원 · 진행 표시 · 맨 위로 ──────────────────
  const listRef = useRef<FlatList<ArticleWithBlog>>(null);
  /** 지금 필터의 목록을 구분하는 키. 필터가 바뀌면 다른 목록이라 위치도 따로 기억한다. */
  const listKey = useMemo(() => JSON.stringify(baseFilter) + `|${filter.sort ?? ""}`, [baseFilter, filter.sort]);
  const [atTop, setAtTop] = useState(true);
  const restored = useRef(false);

  // 필터가 바뀌면 다른 목록이다 — 복원을 다시 시도하게 풀고, 진행 표시도 초기화한다.
  useEffect(() => {
    restored.current = false;
  }, [listKey]);



  // 목록과 같이 스크롤되는 헤더 — 제목 + 필터 칩 + 글 개수.
  const header = (
    <View style={styles.headerWrap}>
      <View style={styles.titleRow}>
        <Text style={[styles.screenTitle, { color: c.textPrimary }]}>피드</Text>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={8} style={styles.searchUtil} onPress={() => nav.navigate("Search")}>
          <Search size={21} color={c.textPrimary} />
        </Pressable>
      </View>
      <FilterSheet blogs={blogsQ.data ?? []} value={filter} onChange={setFilter} variant="chips" />
      {/* 목적 태그가 켜져 있으면 지울 수 있게 보여준다 — 왜 목록이 짧은지 모른 채 헤매지 않도록. */}
      {purpose || service ? (
        <View style={styles.appliedRow}>
          {purpose ? (
            <Pressable
              style={[styles.purposeChip, { backgroundColor: c.primaryTint, borderColor: c.accentTintBorder }]}
              onPress={() => setPurpose(undefined)}
              hitSlop={6}
            >
              <Text style={[styles.purposeText, { color: c.primary }]}>#{purpose}</Text>
              <X size={13} color={c.primary} strokeWidth={2.4} />
            </Pressable>
          ) : null}
          {service ? (
            <Pressable
              style={[styles.purposeChip, { backgroundColor: c.primaryTint, borderColor: c.accentTintBorder }]}
              onPress={() => setService(undefined)}
              hitSlop={6}
            >
              <Text style={[styles.purposeText, { color: c.primary }]}>
                {SERVICE_KIND_META[service].label}
              </Text>
              <X size={13} color={c.primary} strokeWidth={2.4} />
            </Pressable>
          ) : null}
        </View>
      ) : null}
      <View style={styles.filterRow}>
        <Text style={[styles.countText, { color: c.textSecondary }]}>{countLabel}</Text>
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => setUnreadOnly((v) => !v)}
          style={[
            styles.unreadChip,
            {
              backgroundColor: unreadOnly ? c.textPrimary : c.surfaceCard,
              borderColor: unreadOnly ? c.textPrimary : c.hairline,
            },
          ]}
          hitSlop={6}
        >
          <Text style={[styles.unreadText, { color: unreadOnly ? c.surfaceCard : c.textSecondary }]}>
            안 읽은 글만
          </Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      {/* ⚠️ 필터를 목록 **위에 고정하지 않는다.** 히어로 카드까지 화면에 붙박이로 남으면
          작은 폰에서 글이 두세 줄밖에 안 보인다. 목록과 함께 스크롤되도록
          FlatList 의 헤더로 넣는다(아래 ListHeaderComponent). */}
      {/* ⚠️ 로딩·빈 상태에서도 **헤더는 남는다.** 예전처럼 분기로 갈아끼우면 결과가 0건일 때
          필터까지 사라져서, 정작 필터를 바꿔야 하는 순간에 바꿀 수가 없다. */}
      <FlatList
        ref={listRef}
        data={rows}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) => (
          <ArticleRow
            article={item}
            thumbFirst
            onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={
          q.isLoading ? (
            <Loading label="불러오는 중…" />
          ) : q.isError ? (
            <ErrorState onRetry={() => q.refetch()} />
          ) : (
            <EmptyState
              title={unreadOnly ? "안 읽은 글이 없어요" : "글이 없어요"}
              hint={unreadOnly ? "'안 읽은 글만'을 꺼보세요" : "필터를 바꿔보세요"}
            />
          )
        }
        ItemSeparatorComponent={() => <View style={[styles.sep, { backgroundColor: c.hairline }]} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onEndReachedThreshold={0.5}
        onEndReached={() => {
          if (q.hasNextPage && !q.isFetchingNextPage) q.fetchNextPage();
        }}
        scrollEventThrottle={64}
        onScroll={(e) => {
          const y = e.nativeEvent.contentOffset.y;
          lastOffset.set(listKey, y);
          const top = y < TOP_BTN_AT;
          if (top !== atTop) setAtTop(top);
        }}
        /**
         * 읽던 자리로 돌아오기.
         * ⚠️ 마운트 직후에 바로 못 옮긴다 — 그때는 1페이지만 그려져 있어서 그 위치까지
         *    내용이 없다. 내용이 **그 자리를 덮을 만큼 쌓였을 때** 한 번만 옮긴다.
         */
        onContentSizeChange={(_w, h) => {
          if (restored.current) return;
          const y = lastOffset.get(listKey) ?? 0;
          if (y <= 0) {
            restored.current = true;
            return;
          }
          if (h >= y + 200) {
            restored.current = true;
            listRef.current?.scrollToOffset({ offset: y, animated: false });
          }
        }}
      />

      {/* 맨 위로 — 내려간 뒤에만 뜬다. 늘 떠 있으면 카드 한 장을 계속 가린다. */}
      {!atTop ? (
        <Pressable
          style={[styles.topBtn, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
          onPress={() => {
            listRef.current?.scrollToOffset({ offset: 0, animated: true });
            lastOffset.set(listKey, 0);
            setAtTop(true);
          }}
        >
          <ArrowUp size={16} color={c.textPrimary} strokeWidth={2.4} />
          <Text style={[styles.topText, { color: c.textPrimary }]}>맨 위로</Text>
        </Pressable>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  searchUtil: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },

  // 헤더는 목록 좌우 패딩(16) 바깥이라 자체 여백을 갖는다(칩 바가 화면 끝까지 스크롤되게).
  headerWrap: { marginHorizontal: -16 },
  titleRow: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 4 },
  screenTitle: { ...dtype.titleL, fontSize: 21 },
  // 칩 바 ↔ 개수 ↔ 목록 사이 리듬. 간격 스케일(4·8·12·16·24)만 쓴다.
  filterRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 16,
  },
  countText: { ...dtype.label },
  // 목적 태그 칩 — 칩/배지 규격(DESIGN_SYSTEM §3: radius 999).
  purposeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  purposeText: { ...dtype.label, fontSize: 12 },
  appliedRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  unreadChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  unreadText: { ...dtype.label, fontSize: 12 },

  // ⚠️ paddingTop 이 없어서 첫 글이 개수 줄에 붙어 있었다.
  listContent: { paddingHorizontal: 16, paddingTop: 4, paddingBottom: 32 },
  sep: { height: 1 },
  // 하단 탭(70) 위에 뜬다. 떠 있는 pill 이라 그림자를 쓴다(DESIGN_SYSTEM §3).
  topBtn: {
    position: "absolute",
    right: 16,
    bottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 5,
  },
  topText: { ...dtype.label, fontSize: 12.5 },
});
