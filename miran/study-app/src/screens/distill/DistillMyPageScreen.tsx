// distill 마이 탭 (DESIGN_GUIDE §7.6) — 프로필 · 3모아보기(내 의견 · 하이라이트 · 단어장) · 설정.
import React, { useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, MessageSquare, RotateCw, Search, Settings, Star, Trash2, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import {
  useMyOpinions,
  useMyHighlights,
  useMyWords,
  useMyBookmarks,
  useMyComments,
  useMyReads,
  useBlogs,
  useProfile,
  useFavoriteBlogIds,
  useToggleBlogFavorite,
  useDefineWord,
  useDeleteWord,
  type OpinionFeedItem,
  type MyHighlightRow,
  type UserWordRow,
  type MyCommentRow,
  type ArticleWithBlog,
  commentSource,
} from "@/data";
import { dtype , PRETENDARD} from "@/theme";
import { highlightBg } from "@/lib/highlight";
import { bucketHeaders } from "@/lib/dateBucket";
import { Avatar } from "@/components/Avatar";
import { OpinionCard } from "@/components/distill/OpinionCard";
import { ArticleRow, ServiceLogo, TopicChip, relativeDate } from "@/components/distill/ArticleCards";
import { ActivityCalendar, dayKey } from "@/components/distill/ActivityCalendar";
import { ReadingStatsRow } from "@/components/distill/ReadingStatsBadge";
import { ActivityGroupCard } from "@/components/distill/ActivityGroupCard";
import { groupActivity, type ActivityGroup } from "@/lib/groupActivity";
import { WeakDomains } from "@/components/distill/WeakDomains";
import { Loading, EmptyState } from "@/components";

type MyTab =
  | "opinions"
  | "highlights"
  | "bookmarks"
  | "comments"
  | "reads"
  | "words";

const TABS: { key: MyTab; label: string }[] = [
  { key: "opinions", label: "내 의견" },
  { key: "highlights", label: "하이라이트" },
  { key: "bookmarks", label: "북마크" },
  { key: "comments", label: "댓글" },
  { key: "reads", label: "읽음" },
  { key: "words", label: "단어장" },
];

export function DistillMyPageScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [tab, setTab] = useState<MyTab>("opinions");

  const profileQ = useProfile();
  const displayName = profileQ.data?.name?.trim() || "게스트";
  const roleTitle = profileQ.data?.role_title?.trim() || "읽고 생각을 남기는 중";
  const opinionsQ = useMyOpinions();
  const highlightsQ = useMyHighlights();
  const bookmarksQ = useMyBookmarks();
  const commentsQ = useMyComments();
  const readsQ = useMyReads();
  const wordsQ = useMyWords();

  // 관심 기업(즐겨찾기) 관리 모달.
  const [favOpen, setFavOpen] = useState(false);
  const blogsQ = useBlogs();
  const favsQ = useFavoriteBlogIds();
  const toggleFav = useToggleBlogFavorite();
  const favSet = new Set(favsQ.data ?? []);
  const favCount = favsQ.data?.length ?? 0;

  // 활동 캘린더 — 인사이트·하이라이트·댓글·단어 작성일 + 글 읽은 날을 원으로 채운다.
  const activeDays = new Set<string>();
  for (const arr of [opinionsQ.data, highlightsQ.data, commentsQ.data, wordsQ.data]) {
    for (const x of (arr ?? []) as { created_at?: string | null }[]) {
      const k = dayKey(x.created_at ?? "");
      if (k) activeDays.add(k);
    }
  }
  for (const r of readsQ.data ?? []) {
    const k = dayKey(r.read_at ?? "");
    if (k) activeDays.add(k);
  }

  const byTab = {
    opinions: opinionsQ,
    highlights: highlightsQ,
    bookmarks: bookmarksQ,
    comments: commentsQ,
    reads: readsQ,
    words: wordsQ,
  } as const;
  const activeQ = byTab[tab];
  const data = (byTab[tab].data ?? []) as Row[];

  // 하이라이트·단어·댓글은 **같은 글의 활동을 한 카드로** 묶는다.
  //   예전엔 밑줄 5개면 카드 5장이 나와서 목록만 길어지고 어떤 글인지가 안 보였다.
  const grouped = tab === "highlights" || tab === "words" || tab === "comments";

  const groups: ActivityGroup<Row>[] = grouped
    ? groupActivity(
        data as Row[],
        (it) => sourceKeyOf(tab, it),
        (it) => (it as { created_at?: string }).created_at ?? null,
      )
    : [];

  // 날짜별 그룹 헤더 — 묶은 탭은 **그룹의 최근 활동일** 기준.
  const dated =
    tab === "opinions" || tab === "highlights" || tab === "comments" || tab === "words";
  const headers = dated
    ? bucketHeaders(
        grouped
          ? groups.map((g) => g.latest)
          : data.map((it) => (it as { created_at?: string }).created_at ?? null),
        Date.now(),
      )
    : [];

  const emptyByTab: Record<MyTab, { title: string; hint: string }> = {
    opinions: { title: "아직 남긴 의견이 없어요", hint: "글을 읽고 첫 의견을 남겨보세요" },
    highlights: { title: "밑줄 그은 문장이 없어요", hint: "글에서 문장을 눌러 밑줄을 그어보세요" },
    bookmarks: { title: "북마크한 글이 없어요", hint: "글 상세에서 북마크를 눌러 저장해보세요" },
    comments: { title: "남긴 댓글이 없어요", hint: "의견에 답글을 달아보세요" },
    reads: { title: "읽은 글이 없어요", hint: "글을 끝까지 읽으면 여기 모여요" },
    words: { title: "저장한 단어가 없어요", hint: "글에서 문장을 길게 눌러 단어를 담아보세요" },
  };

  /** 같은 글의 활동을 카드 하나로 — 머리에 글 제목, 안에 항목들. */
  const renderGroup = (g: ActivityGroup<Row>) => {
    const head = groupHeadOf(tab, g.items[0]);
    const n = g.items.length;

    if (tab === "highlights") {
      const rows = g.items as MyHighlightRow[];
      const articleId = rows[0].article_id;
      return (
        <ActivityGroupCard
          title={head.title}
          countLabel={n > 1 ? `밑줄 ${n}` : null}
          onPress={
            articleId ? () => nav.navigate("ArticleDetail", { articleId }) : undefined
          }
        >
          {rows.map((h) => (
            <View key={h.id} style={{ gap: 4 }}>
              {h.quote ? (
                <Text
                  style={[
                    styles.hlQuote,
                    { backgroundColor: highlightBg(h.color), color: c.textPrimary },
                  ]}
                  numberOfLines={3}
                >
                  “{h.quote}”
                </Text>
              ) : null}
              {h.note ? (
                <Text style={[styles.hlNote, { color: c.textSecondary }]}>{h.note}</Text>
              ) : null}
            </View>
          ))}
        </ActivityGroupCard>
      );
    }

    if (tab === "words") {
      const rows = g.items as UserWordRow[];
      const articleId = rows[0].article_id;
      return (
        <ActivityGroupCard
          title={head.title}
          countLabel={n > 1 ? `단어 ${n}` : null}
          onPress={
            articleId ? () => nav.navigate("ArticleDetail", { articleId }) : undefined
          }
        >
          {/* WordCard 를 그대로 쓴다 — 삭제·"AI 뜻 다시 만들기"가 이 컴포넌트에 있다. */}
          {rows.map((w) => (
            <WordCard key={w.id} row={w} bare />
          ))}
        </ActivityGroupCard>
      );
    }

    // 댓글 — 원본(인사이트/자유글) 단위
    const rows = g.items as MyCommentRow[];
    const src = commentSource(rows[0]);
    return (
      <ActivityGroupCard
        title={head.title}
        meta={head.meta}
        countLabel={n > 1 ? `댓글 ${n}` : null}
        onPress={
          src
            ? () =>
                src.kind === "opinion"
                  ? nav.navigate("OpinionDetail", { opinionId: src.id })
                  : nav.navigate("CommunityPostDetail", { postId: src.id })
            : undefined
        }
      >
        {rows.map((m) => (
          <Text key={m.id} style={[styles.hlNote, { color: c.textPrimary }]}>
            {m.text}
          </Text>
        ))}
      </ActivityGroupCard>
    );
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      <FlatList
        data={(grouped ? groups : data) as readonly unknown[]}
        keyExtractor={(item) =>
          grouped ? (item as ActivityGroup<Row>).key : (item as { id: string }).id
        }
        renderItem={({ item: raw, index }) => {
          const header = dated ? headers[index] : null;

          if (grouped) {
            const g = raw as ActivityGroup<Row>;
            return (
              <View>
                {header ? (
                  <Text style={[styles.dateHeader, { color: c.textMuted }]}>{header}</Text>
                ) : null}
                {renderGroup(g)}
              </View>
            );
          }

          const item = raw as Row;
          let body: React.ReactElement;
          if (tab === "opinions") {
            const o = item as OpinionFeedItem;
            body = (
              <OpinionCard
                opinion={o}
                onPress={() => nav.navigate("OpinionDetail", { opinionId: o.id })}
              />
            );
          } else if (tab === "bookmarks" || tab === "reads") {
            const a = item as ArticleWithBlog;
            body = <ArticleRow article={a} onPress={() => nav.navigate("ArticleDetail", { articleId: a.id })} />;
          } else {
            // 남는 건 북마크·읽은 글뿐 — 묶음 탭은 위에서 이미 그렸다.
            const a = item as ArticleWithBlog;
            body = (
              <ArticleRow article={a} onPress={() => nav.navigate("ArticleDetail", { articleId: a.id })} />
            );
          }
          return (
            <View>
              {header ? (
                <Text style={[styles.dateHeader, { color: c.textMuted }]}>{header}</Text>
              ) : null}
              {body}
            </View>
          );
        }}
        ItemSeparatorComponent={
          tab === "bookmarks" || tab === "reads"
            ? () => <View style={[styles.sep, { backgroundColor: c.hairline }]} />
            : () => <View style={{ height: 12 }} />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={activeQ.isRefetching}
            onRefresh={() => activeQ.refetch()}
            tintColor={c.primary}
          />
        }
        ListHeaderComponent={
          <View>
            {/* 프로필 */}
            <View style={styles.profile}>
              <Avatar name={displayName} size={56} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: c.textPrimary }]} numberOfLines={1}>
                  {displayName}
                </Text>
                <Text style={[styles.role, { color: c.textMuted }]} numberOfLines={1}>
                  {roleTitle}
                </Text>
              </View>
              <Pressable hitSlop={8} style={styles.iconBtn} onPress={() => nav.navigate("Search")}>
                <Search size={22} color={c.textSecondary} />
              </Pressable>
              <Pressable
                hitSlop={8}
                style={styles.iconBtn}
                onPress={() => nav.navigate("DisplaySettings")}
              >
                <Settings size={22} color={c.textSecondary} />
              </Pressable>
            </View>

            {/* 관심 기업 관리 */}
            <Pressable
              style={[styles.menuRow, { borderColor: c.hairline }]}
              onPress={() => setFavOpen(true)}
            >
              <View style={styles.menuLeft}>
                <Star size={16} color={c.hot} fill={c.hot} />
                <Text style={[styles.menuText, { color: c.textPrimary }]}>관심 기업</Text>
              </View>
              <View style={styles.menuRight}>
                <Text style={[styles.menuCount, { color: c.textMuted }]}>{favCount}</Text>
                <ChevronRight size={18} color={c.textMuted} />
              </View>
            </Pressable>

            {/* 이번 달 수치 — 연속은 살아 있을 때만 3번째 칸에 뜨고, 끊기면 "이번 달 N일"로 바뀐다.
                0 을 보여주지 않는 게 규칙(0 은 벌칙이 된다). */}
            <ReadingStatsRow />

            {/* 활동 캘린더 — 날짜 탭 → 그날 활동 화면 */}
            <ActivityCalendar
              activeDays={activeDays}
              onSelectDay={(date) => nav.navigate("DayActivity", { date })}
            />

            {/* 자주 막히는 영역 — 단어를 누른 기록이 쌓이면 내 학습 지도가 된다. */}
            <WeakDomains />

            {/* 내 활동 — 세그먼트 탭 (가로 스크롤). 앱 설정(테마·로그아웃)은 상단 기어 → 설정 화면. */}
            <Text style={[styles.activityLabel, { color: c.textPrimary }]}>내 활동</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.segScroll}
              style={styles.segmentWrap}
            >
              {TABS.map((t) => {
                const on = tab === t.key;
                return (
                  <Pressable
                    key={t.key}
                    style={[styles.segPill, { backgroundColor: on ? c.primary : c.surfaceSunken }]}
                    onPress={() => setTab(t.key)}
                  >
                    <Text style={[styles.segPillText, { color: on ? c.actionOn : c.textSecondary }]}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {activeQ.isLoading ? <Loading label="불러오는 중…" /> : null}
            {!activeQ.isLoading && data.length === 0 ? (
              <EmptyState title={emptyByTab[tab].title} hint={emptyByTab[tab].hint} />
            ) : null}
          </View>
        }
      />

      {/* 관심 기업 관리 모달 */}
      <Modal visible={favOpen} transparent animationType="slide" onRequestClose={() => setFavOpen(false)}>
        <Pressable style={styles.favBackdrop} onPress={() => setFavOpen(false)}>
          <Pressable style={[styles.favSheet, { backgroundColor: c.surfaceCard }]} onPress={() => {}}>
            <View style={styles.favHead}>
              <Text style={[styles.favTitle, { color: c.textPrimary }]}>관심 기업</Text>
              <Pressable onPress={() => setFavOpen(false)} hitSlop={8}>
                <X size={20} color={c.textMuted} />
              </Pressable>
            </View>
            <Text style={[styles.favHint, { color: c.textMuted }]}>
              즐겨찾기하면 새 글 알림을 받고 홈에서 앞쪽에 보여요.
            </Text>
            <ScrollView style={{ maxHeight: 440 }} showsVerticalScrollIndicator={false}>
              {(blogsQ.data ?? []).map((b) => {
                const on = favSet.has(b.id);
                return (
                  <Pressable
                    key={b.id}
                    style={styles.favRow}
                    onPress={() => toggleFav.mutate({ blogId: b.id, favorite: !on })}
                  >
                    <ServiceLogo name={b.name} brandColor={b.brand_color} homepage={b.homepage} blogKey={b.key} size={32} />
                    <Text style={[styles.favName, { color: c.textPrimary }]}>{b.name}</Text>
                    <Star size={20} color={on ? c.hot : c.textMuted} fill={on ? c.hot : "transparent"} />
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}


/** 마이 목록에 실리는 모든 행. */
type Row =
  | OpinionFeedItem
  | MyHighlightRow
  | ArticleWithBlog
  | MyCommentRow
  | UserWordRow;

/**
 * 활동을 묶을 **원본 id**. 하이라이트·단어는 글, 댓글은 인사이트/자유글이 원본이다.
 * null 이면 묶지 않고 혼자 둔다(원본을 잃은 오래된 행 대비).
 */
function sourceKeyOf(tab: MyTab, row: Row): string | null {
  if (tab === "highlights") return (row as MyHighlightRow).article_id ?? null;
  if (tab === "words") return (row as UserWordRow).article_id ?? null;
  if (tab === "comments") {
    const src = commentSource(row as MyCommentRow);
    return src ? `${src.kind}:${src.id}` : null;
  }
  return null;
}

/** 그룹 머리에 쓸 제목·부가정보. */
function groupHeadOf(tab: MyTab, row: Row): { title: string | null; meta: string | null } {
  if (tab === "highlights") {
    const h = row as MyHighlightRow;
    return { title: h.article?.title ?? null, meta: null };
  }
  if (tab === "words") {
    const w = row as UserWordRow;
    return { title: w.article?.title ?? "글에서 담지 않은 단어", meta: null };
  }
  const src = commentSource(row as MyCommentRow);
  return {
    title: src?.title ?? null,
    meta: src?.kind === "community" ? "커뮤니티 자유글" : "인사이트",
  };
}

// 단어장 카드 — 단어 · 뜻(AI). 뜻이 아직 없으면 "다시 시도"(재요청). 삭제 가능.
/** @param bare 그룹 카드 안에 넣을 때는 자체 테두리를 끈다(카드 속 카드 방지). */
function WordCard({ row, bare = false }: { row: UserWordRow; bare?: boolean }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const define = useDefineWord();
  const del = useDeleteWord();

  return (
    <View
      style={[
        bare ? styles.wordBare : styles.wordCard,
        bare ? null : { backgroundColor: c.surfaceCard, borderColor: c.hairline },
      ]}
    >
      <View style={styles.wordHead}>
        <Text style={[styles.wordTerm, { color: c.textPrimary }]}>{row.term}</Text>
        <Pressable onPress={() => del.mutate(row.id)} hitSlop={8} disabled={del.isPending}>
          <Trash2 size={16} color={c.textMuted} />
        </Pressable>
      </View>

      {row.definition ? (
        <Text style={[styles.wordDef, { color: c.textSecondary }]}>{row.definition}</Text>
      ) : (
        <Pressable
          style={styles.wordRetry}
          onPress={() => define.mutate(row.id)}
          disabled={define.isPending}
        >
          <RotateCw size={13} color={c.primary} />
          <Text style={[styles.wordRetryText, { color: c.primary }]}>
            {define.isPending ? "뜻을 만드는 중…" : "AI 뜻 다시 만들기"}
          </Text>
        </Pressable>
      )}

      {row.context ? (
        <Text style={[styles.wordCtx, { color: c.textMuted }]} numberOfLines={2}>
          “{row.context}”
        </Text>
      ) : null}
    </View>
  );
}



const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  profile: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 16 },
  name: { ...dtype.titleL },
  role: { ...dtype.bodyS, marginTop: 2 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  dateHeader: { ...dtype.label, fontSize: 12.5, fontWeight: "800", fontFamily: PRETENDARD["800"], marginTop: 10, marginBottom: 8 },

  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
  },
  menuText: { ...dtype.cardTitle },
  activityLabel: { ...dtype.title, marginTop: 4, marginBottom: 10 },
  menuLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  menuRight: { flexDirection: "row", alignItems: "center", gap: 4 },
  menuCount: { ...dtype.cardTitle },

  favBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  favSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, gap: 8 },
  favHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  favTitle: { ...dtype.title, fontSize: 17 },
  favHint: { ...dtype.bodyS, marginBottom: 6 },
  favRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11 },
  favName: { ...dtype.cardTitle, flex: 1 },

  segmentWrap: { marginBottom: 16 },
  segScroll: { gap: 8, paddingRight: 8 },
  segPill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  segPillText: { ...dtype.cardTitle, fontSize: 14 },
  sep: { height: 1 },

  commentCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  commentHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  commentDate: { ...dtype.meta },
  commentText: { ...dtype.body, lineHeight: 22 },
  commentSource: { ...dtype.meta },
  draftBadge: { borderRadius: 6, paddingHorizontal: 7, paddingVertical: 2 },
  draftBadgeText: { ...dtype.meta, fontWeight: "800", fontFamily: PRETENDARD["800"] },

  hlCard: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, overflow: "hidden" },
  hlBar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  hlQuote: { ...dtype.body, fontWeight: "600", fontFamily: PRETENDARD["600"], lineHeight: 22 },
  hlNote: { ...dtype.bodyS, lineHeight: 20 },
  hlMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  hlSource: { ...dtype.meta, flex: 1 },

  wordBare: { gap: 4 },
  wordCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  wordHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordTerm: { ...dtype.title, fontSize: 17 },
  wordDef: { ...dtype.body, lineHeight: 23 },
  wordRetry: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  wordRetryText: { ...dtype.cardTitle, fontSize: 13.5 },
  wordCtx: { ...dtype.bodyS, fontStyle: "italic", lineHeight: 19, marginTop: 2 },
});
