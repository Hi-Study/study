// distill 마이 탭 (DESIGN_GUIDE §7.7) — 내 취향 · 달력 · 내 활동(글 단위 + 필터) · 설정.
import React, { useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronDown, RotateCw, Search, Settings, SlidersHorizontal, Trash2 } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import {
  useMyOpinions,
  useMyHighlights,
  useMyWords,
  useMyComments,
  useMyReads,
  useProfile,
  useReadingStats,
  useDefineWord,
  useDeleteWord,
  type UserWordRow,
} from "@/data";
import { dtype, PRETENDARD, WORD_DOMAIN_LABEL } from "@/theme";
import { highlightBg } from "@/lib/highlight";
import { relativeDate } from "@/components/distill/ArticleCards";
import { ActivityCalendar, dayKey } from "@/components/distill/ActivityCalendar";
import { ReadingStreakHero } from "@/components/distill/ReadingStatsBadge";
import { ActivityGroupCard } from "@/components/distill/ActivityGroupCard";
import { InsightBody } from "@/components/distill/InsightBody";
import { WeakDomains } from "@/components/distill/WeakDomains";
import { TasteBars } from "@/components/distill/TasteBars";
import { ActivityFilterSheet } from "@/components/distill/ActivityFilterSheet";
import { analyzeTaste, tasteNarrative } from "@/lib/taste";
import {
  collectMyActivity,
  filterActivity,
  activityCounts,
  activityCategories,
  activityBlogs,
  activityServices,
  activitySummary,
  facetCount,
  resolveFilter,
  ACTIVITY_FILTERS,
  EMPTY_FACETS,
  type ActivityFacets,
  type ActivityFilter,
  type MyActivityItem,
} from "@/lib/myActivity";
import { Loading, EmptyState } from "@/components";

/** 필터별 빈 상태 — "왜 비었는지"와 "무엇을 하면 채워지는지"를 같이 말한다. */
const EMPTY_BY_FILTER: Record<ActivityFilter, { title: string; hint: string }> = {
  opinions: { title: "인사이트를 남긴 글이 없어요", hint: "글을 읽고 첫 인사이트를 남겨보세요" },
  highlights: { title: "밑줄 그은 글이 없어요", hint: "글에서 문장을 눌러 밑줄을 그어보세요" },
  comments: { title: "댓글을 남긴 글이 없어요", hint: "인사이트에 답글을 달아보세요" },
  words: { title: "모인 단어가 없어요", hint: "글을 읽으면 그 글의 '알아두면 편해요' 용어가 쌓여요" },
};

export function DistillMyPageScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  /**
   * 내 활동의 축은 **글**이다. 칩은 탭이 아니라 **좁히는 필터** — 무엇을 남긴 글만 볼지,
   * 어떤 주제의 글만 볼지. 왜 이렇게 바꿨는지는 lib/myActivity.ts 머리말.
   */
  const [filter, setFilter] = useState<ActivityFilter>("opinions");
  /**
   * 칩을 한 번이라도 눌렀나. 처음 들어왔을 때만 **내용이 있는 칩**으로 잡아 주고,
   * 그 뒤로는 사람이 고른 칩을 그대로 둔다 — 0건이면 "없다"고 목록이 말하면 된다.
   */
  const [picked, setPicked] = useState(false);
  const [facets, setFacets] = useState<ActivityFacets>(EMPTY_FACETS);
  const [filterOpen, setFilterOpen] = useState(false);

  const profileQ = useProfile();
  const displayName = profileQ.data?.name?.trim() || "게스트";
  const opinionsQ = useMyOpinions();
  const highlightsQ = useMyHighlights();
  const commentsQ = useMyComments();
  const readsQ = useMyReads();
  const wordsQ = useMyWords();

  /**
   * 맨 위 카드 = **내 취향.** 프로필 카드는 없앴다(아바타도 두지 않는다).
   *
   * 프로필만 있는 카드를 맨 위에 두는 건 자리 낭비다 — 내 이름도 얼굴도 내가 이미 안다.
   * 자기 기록을 보러 온 자리에서 화면이 먼저 할 말은 "당신은 이런 걸 읽는 사람"이다.
   * 카드 본체는 **주제·기업 분포 막대**이고, 문장은 표본이 적을 때만 나온다(lib/taste.ts).
   */
  const stats = useReadingStats().data;
  const taste = analyzeTaste(readsQ.data ?? []);
  const tasteText = tasteNarrative({
    name: displayName,
    taste,
    monthReads: stats?.monthReads ?? 0,
    monthOpinions: stats?.monthOpinions ?? 0,
  });

  // 관심 기업·내 아카이브는 마이에서 걷어냈다 —
  //   아카이브는 하단 탭으로 나가 있고(같은 문이 두 개가 된다),
  //   관심 기업은 기업을 보고 있는 홈에서 켜는 게 자연스럽다(FavoriteBlogsSheet 주석).

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

  // 목록이 다섯 곳에서 합쳐지므로 로딩·새로고침도 다섯을 함께 본다.
  const queries = [opinionsQ, highlightsQ, commentsQ, readsQ, wordsQ];
  const isLoading = queries.some((q) => q.isLoading);
  const isRefetching = queries.some((q) => q.isRefetching);
  const refetchAll = () => queries.forEach((q) => q.refetch());

  /**
   * 내가 손댄 글을 **하나로 합친다** — 읽음·인사이트·밑줄·댓글·용어가 한 카드에 모인다.
   * 용어는 단어장과 같은 함수(lib/wordbook.ts)에서 나온다 — 규칙이 두 벌이면 곧 어긋난다.
   */
  const activity = React.useMemo(
    () =>
      collectMyActivity({
        reads: readsQ.data ?? [],
        opinions: opinionsQ.data ?? [],
        highlights: highlightsQ.data ?? [],
        comments: commentsQ.data ?? [],
        words: wordsQ.data ?? [],
      }),
    [readsQ.data, opinionsQ.data, highlightsQ.data, commentsQ.data, wordsQ.data],
  );
  const counts = activityCounts(activity);
  // 처음 한 번만 내용이 있는 칩으로 잡는다(빈 화면을 첫 인상으로 주지 않으려고).
  //   누른 뒤에는 고른 대로 둔다 — 0건인 칩도 누를 수 있어야 "없다"는 걸 알 수 있다.
  const activeFilter = picked ? filter : resolveFilter(filter, counts);
  // 좁히기 후보는 **내 활동 전체**에서 뽑는다. 고른 종류 안에서만 뽑으면
  //   무엇으로 좁힐 수 있는지조차 종류를 바꿀 때마다 달라진다.
  const categories = activityCategories(activity);
  const blogNames = activityBlogs(activity);
  const services = activityServices(activity);
  const rows = filterActivity(activity, activeFilter, facets);
  const narrowed = facetCount(facets);

  const openArticle = (articleId: string) => nav.navigate("ArticleDetail", { articleId });
  /**
   * 인사이트는 **글 상세의 인사이트 시트**에서 본다 — 그 자리로 스크롤된다.
   * 인사이트만 떼어 보는 상세 화면은 없앴다(PRODUCT.md §4).
   */
  const openOpinion = (articleId: string, opinionId: string) =>
    nav.navigate("ArticleDetail", { articleId, focusOpinionId: opinionId });

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      <FlatList
        data={rows}
        keyExtractor={(item) => item.articleId}
        renderItem={({ item }) => (
          <ActivityCard
            item={item}
            filter={activeFilter}
            onOpen={openArticle}
            onOpenOpinion={openOpinion}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetchAll} tintColor={c.primary} />
        }
        ListHeaderComponent={
          <View>
            {/* 워드마크 + 유틸 — 다른 탭과 머리 모양을 맞춘다(알림 벨은 없앴다) */}
            <View style={styles.topRow}>
              <Text style={[styles.logo, { color: c.textPrimary }]}>
                distill<Text style={{ color: c.primary }}>.</Text>
              </Text>
              <View style={{ flex: 1 }} />
              <Pressable hitSlop={8} style={styles.iconBtn} onPress={() => nav.navigate("Search")}>
                <Search size={21} color={c.textPrimary} />
              </Pressable>
              <Pressable
                hitSlop={8}
                style={styles.iconBtn}
                onPress={() => nav.navigate("DisplaySettings")}
              >
                <Settings size={21} color={c.textPrimary} />
              </Pressable>
            </View>

            {/* 섹션 간격은 **여기 gap 하나로만** 정한다.
                예전엔 카드마다 자기 marginTop/marginBottom(4·8·12·14)을 들고 있어서
                위아래 간격이 제각각이었다. 컴포넌트에서 외부 여백을 다 걷어냈다. */}
            <View style={styles.sections}>
              {/* ① 연속 읽기 · 이번 달 수치 — "그 달이 어땠는지". 0 은 보여주지 않는다(0 은 벌칙이 된다). */}
              <ReadingStreakHero />

              {/* ② 내 취향 — 막대 두 축(주제·기업). 프로필 카드는 없앴다. */}
              <View style={[styles.tasteCard, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
                {/* 제목만 — 아바타는 뺐다. 내 얼굴은 내가 이미 알고, 이 카드가 할 말은
                    "당신은 이런 걸 읽는 사람"이다. */}
                <Text style={[styles.tasteName, { color: c.textPrimary }]} numberOfLines={1}>
                  {displayName}님의 취향을 분석해봤어요
                </Text>
                {/* 표본이 적을 때만 문장으로 말한다("3편 더 읽으면 …").
                    막대는 비율을 그릴 뿐, **아직 단정할 수 없다**는 말을 못 한다. */}
                {!taste.enough ? (
                  <Text style={[styles.tasteText, { color: c.textPrimary }]}>{tasteText}</Text>
                ) : null}
                {/* 본체는 **분포 막대** — 무엇을(대분류) · 어디 글을(기업) 읽는 사람인가.
                    문장은 막대가 못 하는 말(이번 달 편수 · 표본이 적을 때의 유보)만 한다. */}
                {taste.total > 0 ? (
                  <TasteBars
                    categories={taste.categories}
                    blogs={taste.blogs}
                    categoryTotal={taste.total}
                    blogTotal={taste.totalReads}
                  />
                ) : null}
                {/* ⚠️ 태그 칩(#효율화 …)은 뺐다. 막대 두 축(주제·기업)이 이미 취향을 말하는데
                    칩까지 얹으면 같은 카드에서 세 가지 분류 체계가 동시에 말한다. */}
              </View>

              {/* ③ 달력 — 들어오자마자 이번 주가 보여야 달력을 둔 의미가 있다(DESIGN_GUIDE §7.7). */}
              <ActivityCalendar
                title={`${displayName}님의 달력`}
                activeDays={activeDays}
                onSelectDay={(date) => nav.navigate("DayActivity", { date })}
              />

              {/* ④ 자주 막히는 영역 — 단어를 누른 기록이 쌓이면 내 학습 지도가 된다. */}
              <WeakDomains />

              {/* ⑤ 내 활동 — 글 하나가 카드 하나.
                  필터는 **한 줄**: 왼쪽에 고정된 주제 버튼, 오른쪽에 종류 칩이 스크롤한다. */}
              <View style={{ gap: 10 }}>
                <Text style={[styles.activityLabel, { color: c.textPrimary }]}>내 활동</Text>
                <View style={styles.filterRow}>
                  {/* 필터 — 기간·주제·기업·서비스 종류. 고른 개수를 버튼에 적는다. */}
                  <Pressable
                    style={[
                      styles.catBtn,
                      {
                        borderColor: narrowed > 0 ? c.primary : c.hairline,
                        backgroundColor: narrowed > 0 ? c.primaryTint : "transparent",
                      },
                    ]}
                    onPress={() => setFilterOpen(true)}
                  >
                    <SlidersHorizontal size={13} color={narrowed > 0 ? c.primary : c.textMuted} />
                    <Text
                      style={[
                        styles.catBtnText,
                        { color: narrowed > 0 ? c.primary : c.textSecondary },
                      ]}
                      numberOfLines={1}
                    >
                      {narrowed > 0 ? `필터 ${narrowed}` : "필터"}
                    </Text>
                    <ChevronDown size={14} color={narrowed > 0 ? c.primary : c.textMuted} />
                  </Pressable>

                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.segScroll}
                    style={{ flex: 1 }}
                  >
                    {ACTIVITY_FILTERS.map((f) => {
                      const n = counts[f.key];
                      const on = activeFilter === f.key;
                      return (
                        <Pressable
                          key={f.key}
                          // ⚠️ **0건이어도 막지 않는다.** 예전엔 흐리게 두고 눌리지 않게 했는데,
                          //    그러면 "왜 안 눌리지"가 되고 비었다는 사실조차 알 수 없다.
                          //    누르면 목록이 "아직 없어요"라고 말한다.
                          style={[
                            styles.segPill,
                            { backgroundColor: on ? c.primary : c.surfaceSunken },
                          ]}
                          onPress={() => {
                            setPicked(true);
                            setFilter(f.key);
                          }}
                        >
                          <Text
                            style={[styles.segPillText, { color: on ? c.actionOn : c.textSecondary }]}
                          >
                            {n > 0 ? `${f.label} ${n}` : f.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </View>

            {isLoading ? <Loading label="불러오는 중…" /> : null}
            {!isLoading && rows.length === 0 ? (
              // 필터로 0건인 것과 원래 없는 것은 **다른 상황**이다 — 할 일이 다르다.
              narrowed > 0 ? (
                <EmptyState
                  title="조건에 맞는 글이 없어요"
                  hint="필터를 지우면 다시 보여요"
                />
              ) : (
                <EmptyState
                  title={EMPTY_BY_FILTER[activeFilter].title}
                  hint={EMPTY_BY_FILTER[activeFilter].hint}
                />
              )
            ) : null}
          </View>
        }
      />

      <ActivityFilterSheet
        visible={filterOpen}
        categories={categories}
        blogs={blogNames}
        services={services}
        value={facets}
        onChange={setFacets}
        onClose={() => setFilterOpen(false)}
      />
    </SafeAreaView>
  );
}


/**
 * 내 활동 카드 — **글 하나**. 머리에 글 제목·출처·주제, 안에 내가 남긴 것.
 *
 * 요약 줄("인사이트 1 · 밑줄 3 · 용어 5")은 늘 두고, 그 아래엔 **고른 종류만** 펼친다 —
 * 한 글의 밑줄·용어를 한꺼번에 펼치면 카드 하나가 화면을 다 먹는다.
 */
function ActivityCard({
  item,
  filter,
  onOpen,
  onOpenOpinion,
}: {
  item: MyActivityItem;
  filter: ActivityFilter;
  onOpen: (articleId: string) => void;
  onOpenOpinion: (articleId: string, opinionId: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const meta = [item.blogName, item.category, item.latest ? relativeDate(item.latest) : null]
    .filter(Boolean)
    .join(" · ");
  const summary = activitySummary(item);

  return (
    <ActivityGroupCard title={item.title} meta={meta} onPress={() => onOpen(item.articleId)}>
      {summary ? <Text style={[styles.actSummary, { color: c.primary }]}>{summary}</Text> : null}

      {/* 인사이트는 **질문과 답을 짝으로** 그린다(InsightBody) — 답만 있으면 무엇에 답한
          말인지 모른다. compact 는 항목을 빼는 게 아니라 항목별 길이만 줄인다. */}
      {filter === "opinions"
        ? item.opinions.map((o) => (
            <Pressable key={o.id} onPress={() => onOpenOpinion(item.articleId, o.id)}>
              <InsightBody insight={o.insight} compact />
            </Pressable>
          ))
        : null}

      {filter === "highlights"
        ? item.highlights.map((h) => (
            <View key={h.id} style={{ gap: 4 }}>
              {h.quote ? (
                <Text
                  style={[styles.hlQuote, { backgroundColor: highlightBg(h.color), color: c.textPrimary }]}
                  numberOfLines={3}
                >
                  “{h.quote}”
                </Text>
              ) : null}
              {h.note ? <Text style={[styles.hlNote, { color: c.textSecondary }]}>{h.note}</Text> : null}
            </View>
          ))
        : null}

      {filter === "comments"
        ? item.comments.map((m) => (
            <Text key={m.id} style={[styles.hlNote, { color: c.textPrimary }]}>
              {m.text}
            </Text>
          ))
        : null}

      {filter === "words"
        ? item.terms.map((t) =>
            // 담은 단어는 WordCard 로 — 삭제·"AI 뜻 다시 만들기"가 이 컴포넌트에 있다.
            t.picked ? (
              <WordCard key={t.term} row={t.picked as UserWordRow} bare />
            ) : (
              <View key={t.term} style={styles.wbRow}>
                <Text style={[styles.wbTerm, { color: c.textPrimary }]}>
                  {t.term}
                  {WORD_DOMAIN_LABEL[t.domain] ? (
                    <Text style={[styles.wbDomain, { color: c.textMuted }]}>
                      {`  ${WORD_DOMAIN_LABEL[t.domain]}`}
                    </Text>
                  ) : null}
                </Text>
                <Text style={[styles.wbPlain, { color: c.textSecondary }]}>{t.plain}</Text>
              </View>
            ),
          )
        : null}
    </ActivityGroupCard>
  );
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

  topRow: { flexDirection: "row", alignItems: "center", paddingBottom: 6 },
  logo: { fontSize: 21, fontWeight: "800", fontFamily: PRETENDARD["800"], letterSpacing: -0.5 },
  /** 섹션 사이 간격 — 마이의 모든 여백은 이 값 하나에서 나온다. */
  sections: { gap: 14, marginBottom: 14 },

  // 내 취향 = 맨 위 카드. 프로필은 머리줄에 작게 얹는다(이름은 내가 이미 안다).
  tasteCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  tasteName: { ...dtype.title },
  tasteText: { ...dtype.body, fontSize: 15.5, lineHeight: 25 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  dateHeader: { ...dtype.label, fontSize: 12.5, fontWeight: "800", fontFamily: PRETENDARD["800"], marginTop: 10, marginBottom: 8 },

  activityLabel: { ...dtype.title, marginBottom: 10 },

  // 내 활동 카드 — 요약 한 줄(내가 남긴 것) + 대표 한 줄.
  actSummary: { ...dtype.meta, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  actLead: { ...dtype.bodyS, lineHeight: 21 },

  // 필터 한 줄 — 주제 버튼은 고정, 종류 칩만 스크롤한다.
  filterRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  catBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 8,
    borderRadius: 999,
    maxWidth: 148,
  },
  catBtnText: { ...dtype.meta, fontWeight: "600", fontFamily: PRETENDARD["600"], flexShrink: 1 },

  // 단어장 — 글 카드 안의 한 줄(단어 · 영역 · 뜻).
  wbRow: { gap: 3 },
  wbTerm: { ...dtype.cardTitle, fontSize: 15 },
  wbDomain: { ...dtype.meta, fontWeight: "500", fontFamily: PRETENDARD["500"] },
  wbPlain: { ...dtype.bodyS, lineHeight: 21 },
  // 관심 기업 시트·아카이브 메뉴 스타일은 걷어냈다 — 관심 기업은 홈, 아카이브는 하단 탭에 있다.

  segScroll: { gap: 8, paddingRight: 8 },
  segPill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 999 },
  segPillText: { ...dtype.cardTitle, fontSize: 14 },


  hlQuote: { ...dtype.body, fontWeight: "600", fontFamily: PRETENDARD["600"], lineHeight: 22 },
  hlNote: { ...dtype.bodyS, lineHeight: 20 },

  wordBare: { gap: 4 },
  wordCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  wordHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordTerm: { ...dtype.title, fontSize: 17 },
  wordDef: { ...dtype.body, lineHeight: 23 },
  wordRetry: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  wordRetryText: { ...dtype.cardTitle, fontSize: 13.5 },
  wordCtx: { ...dtype.bodyS, fontStyle: "italic", lineHeight: 19, marginTop: 2 },
});
