import { useMemo, type ReactNode } from "react";
import { RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useSharesFeed, type ShareFeedFilter, type ShareWithMeta } from "@/data/shares";
import { addDays, formatMonthDay, fromISODate, toISODate } from "@/lib/date";
import { ShareCard } from "./ShareCard";
import { EmptyState, ErrorState, Loading } from "./Feedback";
import { PRETENDARD } from "@/theme";

/** 날짜 라벨(오늘/어제/M월 D일). */
function dateLabel(iso: string, todayISO: string): string {
  if (iso === todayISO) return "오늘";
  if (iso === toISODate(addDays(fromISODate(todayISO), -1))) return "어제";
  return formatMonthDay(fromISODate(iso));
}

/** shared_date 로 묶어 최신 날짜부터 섹션 구성. */
function buildSections(shares: ShareWithMeta[], todayISO: string) {
  const map = new Map<string, ShareWithMeta[]>();
  for (const s of shares) {
    const arr = map.get(s.shared_date) ?? [];
    arr.push(s);
    map.set(s.shared_date, arr);
  }
  return [...map.keys()]
    .sort((a, b) => (a < b ? 1 : -1))
    .map((d) => ({ title: dateLabel(d, todayISO), data: map.get(d)! }));
}

/**
 * 공유 글 무한 스크롤 목록(날짜별 섹션, Slack 스타일). 홈/검색 공용.
 * filter 로 검색·태그·날짜 범위를 넘긴다. header 로 검색바 등을 리스트 상단에 얹는다.
 */
export function SharesSectionList({
  studyId,
  filter,
  onOpen,
  header,
  emptyTitle,
}: {
  studyId: string;
  filter: ShareFeedFilter;
  onOpen: (id: string) => void;
  header?: ReactNode;
  emptyTitle: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const today = useMemo(() => new Date(), []);
  const todayISO = toISODate(today);

  const feed = useSharesFeed(studyId, filter);
  const all = useMemo(() => feed.data?.pages.flatMap((p) => p.rows) ?? [], [feed.data]);
  const sections = useMemo(() => buildSections(all, todayISO), [all, todayISO]);

  if (feed.isError) {
    return <ErrorState message={feed.error?.message} onRetry={() => feed.refetch()} />;
  }

  return (
    <SectionList
      style={styles.flex}
      sections={sections}
      keyExtractor={(s) => s.id}
      renderItem={({ item }) => <ShareCard share={item} onPress={() => onOpen(item.id)} />}
      renderSectionHeader={({ section }) => (
        <View style={[styles.dateHeader, { backgroundColor: c.surfacePage }]}>
          <Text style={[styles.dateHeaderText, { color: c.textMuted }]}>{section.title}</Text>
        </View>
      )}
      ListHeaderComponent={header ? <View style={{ marginBottom: 6 }}>{header}</View> : undefined}
      ListEmptyComponent={
        feed.isLoading ? <Loading /> : <EmptyState title={emptyTitle} />
      }
      ListFooterComponent={
        feed.isFetchingNextPage ? (
          <View style={{ paddingVertical: 16 }}>
            <Loading />
          </View>
        ) : (
          <View style={{ height: 28 }} />
        )
      }
      onEndReached={() => {
        if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage();
      }}
      onEndReachedThreshold={0.5}
      refreshControl={
        <RefreshControl refreshing={feed.isRefetching} onRefresh={() => feed.refetch()} tintColor={c.primary} />
      }
      stickySectionHeadersEnabled
      contentContainerStyle={styles.listContent}
      keyboardShouldPersistTaps="handled"
    />
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  listContent: { padding: 16, paddingTop: 12 },
  dateHeader: { paddingVertical: 6, marginHorizontal: -8, marginTop: 4 },
  dateHeaderText: { fontSize: 12.5, fontWeight: "700", fontFamily: PRETENDARD["700"] },
});
