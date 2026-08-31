// 그날의 활동 — 마이 활동 캘린더에서 날짜를 누르면 진입.
//   그 하루에 남긴 인사이트 · 하이라이트 · 댓글 · 단어 · 읽은 글을 한 화면에 모아 보여준다.
//   (별도 쿼리 없이 마이 탭이 이미 쓰는 use* 훅 결과를 날짜로 걸러 재사용한다.)
import React, { useMemo } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import {
  useMyOpinions,
  useMyHighlights,
  useMyComments,
  useMyWords,
  useMyReads,
  commentSource,
} from "@/data";
import { dtype } from "@/theme";
import { highlightBg } from "@/lib/highlight";
import { OpinionCard } from "@/components/distill/OpinionCard";
import { ArticleRow } from "@/components/distill/ArticleCards";
import { dayKey } from "@/components/distill/ActivityCalendar";
import { EmptyState, Loading } from "@/components";

type Props = NativeStackScreenProps<RootStackParamList, "DayActivity">;

/** 'YYYY-MM-DD' → '8월 27일 (수)'. */
function formatDay(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  if (!y || !m || !d) return key;
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][new Date(y, m - 1, d).getDay()];
  return `${m}월 ${d}일 (${weekday})`;
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  const { theme } = useTheme();
  const c = theme.colors;
  if (count === 0) return null;
  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>{title}</Text>
        <Text style={[styles.sectionCount, { color: c.textMuted }]}>{count}</Text>
      </View>
      {children}
    </View>
  );
}

export function DayActivityScreen({ route }: Props) {
  const { date } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();

  const opinionsQ = useMyOpinions();
  const highlightsQ = useMyHighlights();
  const commentsQ = useMyComments();
  const wordsQ = useMyWords();
  const readsQ = useMyReads();

  const loading =
    opinionsQ.isLoading ||
    highlightsQ.isLoading ||
    commentsQ.isLoading ||
    wordsQ.isLoading ||
    readsQ.isLoading;

  const onDay = <T,>(rows: T[] | undefined, at: (row: T) => string | null | undefined): T[] =>
    (rows ?? []).filter((r) => dayKey(at(r) ?? "") === date);

  const opinions = useMemo(() => onDay(opinionsQ.data, (o) => o.created_at), [opinionsQ.data, date]);
  const highlights = useMemo(() => onDay(highlightsQ.data, (h) => h.created_at), [highlightsQ.data, date]);
  const comments = useMemo(() => onDay(commentsQ.data, (m) => m.created_at), [commentsQ.data, date]);
  const words = useMemo(() => onDay(wordsQ.data, (w) => w.created_at), [wordsQ.data, date]);
  const reads = useMemo(() => onDay(readsQ.data, (a) => a.read_at), [readsQ.data, date]);

  const total = opinions.length + highlights.length + comments.length + words.length + reads.length;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.backBtn}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: c.textPrimary }]}>{formatDay(date)}</Text>
          <Text style={[styles.headerSub, { color: c.textMuted }]}>
            {total > 0 ? `활동 ${total}개` : "활동 없음"}
          </Text>
        </View>
      </View>

      {loading ? (
        <Loading label="불러오는 중…" />
      ) : total === 0 ? (
        <EmptyState title="이 날은 활동이 없어요" hint="글을 읽고 인사이트를 남기면 여기에 쌓여요" />
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Section title="남긴 인사이트" count={opinions.length}>
            <View style={{ gap: 12 }}>
              {opinions.map((o) => (
                <OpinionCard
                  key={o.id}
                  opinion={o}
                  onPress={() =>
                    o.article
                      ? nav.navigate("ArticleDetail", { articleId: o.article.id, focusOpinionId: o.id })
                      : nav.navigate("OpinionDetail", { opinionId: o.id })
                  }
                />
              ))}
            </View>
          </Section>

          <Section title="하이라이트" count={highlights.length}>
            {highlights.map((h) => (
              <Pressable
                key={h.id}
                style={[styles.row, { borderColor: c.hairline }]}
                onPress={() => nav.navigate("ArticleDetail", { articleId: h.article_id })}
              >
                {h.quote ? (
                  <Text style={[styles.quote, { backgroundColor: highlightBg(h.color), color: c.textPrimary }]}>
                    {h.quote}
                  </Text>
                ) : null}
                {h.note ? <Text style={[styles.note, { color: c.textSecondary }]}>{h.note}</Text> : null}
                <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
                  {h.article?.title ?? ""}
                </Text>
              </Pressable>
            ))}
          </Section>

          <Section title="쓴 댓글" count={comments.length}>
            {comments.map((m) => {
              const src = commentSource(m);
              return (
                <Pressable
                  key={m.id}
                  style={[styles.row, { borderColor: c.hairline }]}
                  disabled={!src}
                  onPress={() =>
                    src?.kind === "opinion"
                      ? nav.navigate("OpinionDetail", { opinionId: src.id })
                      : src
                        ? nav.navigate("CommunityPostDetail", { postId: src.id })
                        : undefined
                  }
                >
                  <Text style={[styles.note, { color: c.textPrimary }]}>{m.text}</Text>
                  <Text style={[styles.rowMeta, { color: c.textMuted }]} numberOfLines={1}>
                    {src?.title ?? ""}
                  </Text>
                </Pressable>
              );
            })}
          </Section>

          <Section title="담은 단어" count={words.length}>
            {words.map((w) => (
              <View key={w.id} style={[styles.row, { borderColor: c.hairline }]}>
                <Text style={[styles.term, { color: c.textPrimary }]}>{w.term}</Text>
                {w.definition ? (
                  <Text style={[styles.note, { color: c.textSecondary }]}>{w.definition}</Text>
                ) : null}
              </View>
            ))}
          </Section>

          <Section title="읽은 글" count={reads.length}>
            {reads.map((a) => (
              <ArticleRow
                key={a.id}
                article={a}
                onPress={() => nav.navigate("ArticleDetail", { articleId: a.id })}
              />
            ))}
          </Section>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingBottom: 8 },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...dtype.titleL },
  headerSub: { ...dtype.meta, marginTop: 1 },

  content: { paddingHorizontal: 16, paddingBottom: 40 },
  section: { marginTop: 18 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  sectionTitle: { ...dtype.title },
  sectionCount: { ...dtype.label, fontSize: 13 },

  row: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6, marginBottom: 10 },
  quote: { ...dtype.bodyS, fontWeight: "600", paddingHorizontal: 4, borderRadius: 4 },
  note: { ...dtype.bodyS },
  term: { ...dtype.cardTitle, fontSize: 15 },
  rowMeta: { ...dtype.meta },
});
