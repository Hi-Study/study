// distill 마이 탭 (DESIGN_GUIDE §7.6) — 프로필 · 3모아보기(내 의견 · 하이라이트 · 단어장) · 설정.
import React, { useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, RotateCw, Settings, Trash2 } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import {
  useMyOpinions,
  useMyHighlights,
  useMyWords,
  useDefineWord,
  useDeleteWord,
  type OpinionFeedItem,
  type MyHighlightRow,
  type UserWordRow,
} from "@/data";
import { dtype } from "@/theme";
import { highlightBg } from "@/lib/highlight";
import { Avatar } from "@/components/Avatar";
import { OpinionCard } from "@/components/distill/OpinionCard";
import { TopicChip } from "@/components/distill/ArticleCards";
import { Loading, EmptyState } from "@/components";

type MyTab = "opinions" | "highlights" | "words";

const TABS: { key: MyTab; label: string }[] = [
  { key: "opinions", label: "내 의견" },
  { key: "highlights", label: "하이라이트" },
  { key: "words", label: "단어장" },
];

export function DistillMyPageScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [tab, setTab] = useState<MyTab>("opinions");

  const opinionsQ = useMyOpinions();
  const highlightsQ = useMyHighlights();
  const wordsQ = useMyWords();

  const opinions = opinionsQ.data ?? [];
  const highlights = highlightsQ.data ?? [];
  const words = wordsQ.data ?? [];

  const activeQ = tab === "opinions" ? opinionsQ : tab === "highlights" ? highlightsQ : wordsQ;
  const data: Array<OpinionFeedItem | MyHighlightRow | UserWordRow> =
    tab === "opinions" ? opinions : tab === "highlights" ? highlights : words;

  const emptyByTab: Record<MyTab, { title: string; hint: string }> = {
    opinions: { title: "아직 남긴 의견이 없어요", hint: "글을 읽고 첫 의견을 남겨보세요" },
    highlights: { title: "밑줄 그은 문장이 없어요", hint: "글에서 문장을 눌러 밑줄을 그어보세요" },
    words: { title: "저장한 단어가 없어요", hint: "글에서 문장을 길게 눌러 단어를 담아보세요" },
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      <FlatList
        data={data}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          if (tab === "opinions") {
            const o = item as OpinionFeedItem;
            return (
              <OpinionCard
                opinion={o}
                onPress={() => nav.navigate("OpinionDetail", { opinionId: o.id })}
              />
            );
          }
          if (tab === "highlights") {
            return (
              <HighlightRow
                row={item as MyHighlightRow}
                onPress={(articleId) => nav.navigate("ArticleDetail", { articleId })}
              />
            );
          }
          return <WordCard row={item as UserWordRow} />;
        }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
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
              <Avatar name="게스트" size={56} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: c.textPrimary }]}>게스트</Text>
                <Text style={[styles.role, { color: c.textMuted }]}>읽고 생각을 남기는 중</Text>
              </View>
              <Pressable
                hitSlop={8}
                style={styles.iconBtn}
                onPress={() => nav.navigate("DisplaySettings")}
              >
                <Settings size={22} color={c.textSecondary} />
              </Pressable>
            </View>

            {/* 통계 3 */}
            <View style={styles.stats}>
              <StatCard label="내 의견" value={opinions.length} />
              <StatCard label="하이라이트" value={highlights.length} />
              <StatCard label="단어" value={words.length} />
            </View>

            {/* 설정 바로가기 */}
            <Pressable
              style={[styles.menuRow, { borderColor: c.hairline }]}
              onPress={() => nav.navigate("DisplaySettings")}
            >
              <Text style={[styles.menuText, { color: c.textPrimary }]}>화면 설정 (테마)</Text>
              <ChevronRight size={18} color={c.textMuted} />
            </Pressable>

            {/* 세그먼트 탭 */}
            <View style={[styles.segment, { backgroundColor: c.surfaceSunken }]}>
              {TABS.map((t) => {
                const on = tab === t.key;
                return (
                  <Pressable
                    key={t.key}
                    style={[styles.segBtn, on && { backgroundColor: c.surfaceCard }]}
                    onPress={() => setTab(t.key)}
                  >
                    <Text style={[styles.segText, { color: on ? c.primary : c.textMuted }]}>
                      {t.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {activeQ.isLoading ? <Loading label="불러오는 중…" /> : null}
            {!activeQ.isLoading && data.length === 0 ? (
              <EmptyState title={emptyByTab[tab].title} hint={emptyByTab[tab].hint} />
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.statCard, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
      <Text style={[styles.statNum, { color: c.textPrimary }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}

// 내 하이라이트 한 줄 — 밑줄색 바 · 인용문 · 감상 · 출처 글(탭하면 글로 이동).
function HighlightRow({
  row,
  onPress,
}: {
  row: MyHighlightRow;
  onPress: (articleId: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={() => onPress(row.article_id)}
      style={({ pressed }) => [
        styles.hlCard,
        { backgroundColor: c.surfaceCard, borderColor: c.hairline, opacity: pressed ? 0.95 : 1 },
      ]}
    >
      <View style={[styles.hlBar, { backgroundColor: highlightBg(row.color) }]} />
      <View style={{ flex: 1, gap: 6 }}>
        {row.quote ? (
          <Text style={[styles.hlQuote, { color: c.textPrimary }]} numberOfLines={3}>
            “{row.quote}”
          </Text>
        ) : null}
        {row.note ? (
          <Text style={[styles.hlNote, { color: c.textSecondary }]} numberOfLines={2}>
            {row.note}
          </Text>
        ) : null}
        <View style={styles.hlMeta}>
          {row.article?.topic ? <TopicChip topic={row.article.topic} /> : null}
          <Text style={[styles.hlSource, { color: c.textMuted }]} numberOfLines={1}>
            {row.article?.title ?? "원문"}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

// 단어장 카드 — 단어 · 뜻(AI). 뜻이 아직 없으면 "다시 시도"(재요청). 삭제 가능.
function WordCard({ row }: { row: UserWordRow }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const define = useDefineWord();
  const del = useDeleteWord();

  return (
    <View style={[styles.wordCard, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
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

  stats: { flexDirection: "row", gap: 10, marginBottom: 16 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 16, paddingVertical: 16, alignItems: "center", gap: 4 },
  statNum: { ...dtype.display, fontSize: 22 },
  statLabel: { ...dtype.meta },

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

  segment: { flexDirection: "row", borderRadius: 12, padding: 3, marginBottom: 16, gap: 3 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: "center" },
  segText: { ...dtype.cardTitle, fontSize: 14 },

  hlCard: { flexDirection: "row", gap: 12, borderWidth: 1, borderRadius: 16, padding: 14, overflow: "hidden" },
  hlBar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  hlQuote: { ...dtype.body, fontWeight: "600", lineHeight: 22 },
  hlNote: { ...dtype.bodyS, lineHeight: 20 },
  hlMeta: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 },
  hlSource: { ...dtype.meta, flex: 1 },

  wordCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  wordHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  wordTerm: { ...dtype.title, fontSize: 17 },
  wordDef: { ...dtype.body, lineHeight: 23 },
  wordRetry: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 2 },
  wordRetryText: { ...dtype.cardTitle, fontSize: 13.5 },
  wordCtx: { ...dtype.bodyS, fontStyle: "italic", lineHeight: 19, marginTop: 2 },
});
