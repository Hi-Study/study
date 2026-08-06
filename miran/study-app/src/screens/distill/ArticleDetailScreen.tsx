// distill 글 상세 — 원문(DESIGN_GUIDE §7.4).
//   [히어로 + 뒤로] · 주제칩·읽기시간 · 제목 · 출처칩·작성일 · 본문 · 원문보기↗ · 하단 CTA
// TODO(B-2 확장): 본문 문장 하이라이트(article_highlights) + 하단 인사이트 모아보기.
import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft, ExternalLink } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { dtype } from "@/theme";
import { cleanBody, readingMinutes } from "@/lib/text";
import type { SummaryMode } from "@/lib/summary";
import { useArticle, useOpinions, useRequestArticleSummary } from "@/data";
import { ServiceLogo, TopicChip, relativeDate } from "@/components/distill/ArticleCards";
import { ArticleHighlightSection } from "@/components/distill/ArticleHighlightSection";
import { Avatar } from "@/components/Avatar";
import { Loading, ErrorState } from "@/components";

type Props = NativeStackScreenProps<RootStackParamList, "ArticleDetail">;

export function ArticleDetailScreen({ route }: Props) {
  const { articleId } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const q = useArticle(articleId);
  // ⚠️ 훅은 early return 앞에서 무조건 호출 (React 훅 규칙 — 렌더마다 개수 동일).
  const [tab, setTab] = useState<"original" | "ai">("original");

  if (q.isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]}>
        <Loading label="불러오는 중…" />
      </SafeAreaView>
    );
  }
  if (q.isError || !q.data) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]}>
        <ErrorState onRetry={() => q.refetch()} />
      </SafeAreaView>
    );
  }

  const a = q.data;
  const body = cleanBody(a.body);
  const mins = readingMinutes(a.body);

  return (
    <View style={[styles.screen, { backgroundColor: c.surfacePage }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 히어로 */}
        <View style={[styles.hero, { backgroundColor: c.surfaceSunken }]}>
          {a.og_image ? (
            <Image source={{ uri: a.og_image }} style={styles.heroImg} resizeMode="cover" />
          ) : null}
        </View>

        <View style={styles.body}>
          {/* 주제칩 + 읽기시간 */}
          <View style={styles.metaTop}>
            {a.topic ? <TopicChip topic={a.topic} /> : null}
            {mins ? <Text style={[styles.readTime, { color: c.textMuted }]}>{mins}분 읽기</Text> : null}
          </View>

          {/* 제목 */}
          <Text style={[styles.title, { color: c.textPrimary }]}>{a.title}</Text>

          {/* 출처 + 작성일 */}
          <View style={styles.source}>
            <ServiceLogo name={a.blog?.name ?? "?"} brandColor={a.blog?.brand_color} size={24} />
            <Text style={[styles.sourceText, { color: c.textSecondary }]}>
              {a.blog?.name ?? ""}
              {a.author ? ` · ${a.author}` : ""}
              {a.published_at ? ` · ${relativeDate(a.published_at)}` : ""}
            </Text>
          </View>

          {/* 원문 보기 */}
          <Pressable
            style={[styles.sourceLink, { borderColor: c.hairline }]}
            onPress={() => Linking.openURL(a.url).catch(() => undefined)}
          >
            <Text style={[styles.sourceLinkText, { color: c.textLink }]} numberOfLines={1}>
              원문에서 읽기
            </Text>
            <ExternalLink size={16} color={c.textLink} />
          </Pressable>

          {/* 원문 / AI 요약 탭 */}
          <View style={[styles.tabs, { borderColor: c.hairline }]}>
            <Pressable
              style={[styles.tab, tab === "original" && { backgroundColor: c.primaryTint }]}
              onPress={() => setTab("original")}
            >
              <Text style={[styles.tabText, { color: tab === "original" ? c.primary : c.textMuted }]}>
                원문
              </Text>
            </Pressable>
            <Pressable
              style={[styles.tab, tab === "ai" && { backgroundColor: c.primaryTint }]}
              onPress={() => setTab("ai")}
            >
              <Text style={[styles.tabText, { color: tab === "ai" ? c.primary : c.textMuted }]}>
                AI 요약
              </Text>
            </Pressable>
          </View>

          {tab === "original" ? (
            body.length > 0 ? (
              <ArticleHighlightSection articleId={a.id} text={body} />
            ) : (
              <Text style={[styles.paragraph, { color: c.textMuted }]}>
                본문이 없어요. 원문에서 읽어보세요.
              </Text>
            )
          ) : (
            <AiSummaryPanel
              articleId={a.id}
              cached={a.ai_summaries as Record<string, string> | null | undefined}
            />
          )}

          {/* 의견 모아보기 */}
          <OpinionsSection articleId={a.id} />
        </View>
      </ScrollView>

      {/* 플로팅 뒤로가기 */}
      <SafeAreaView style={styles.backWrap} edges={["top"]} pointerEvents="box-none">
        <Pressable
          style={[styles.backBtn, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
          onPress={() => nav.goBack()}
          hitSlop={8}
        >
          <ChevronLeft size={22} color={c.textPrimary} />
        </Pressable>
      </SafeAreaView>

      {/* 하단 고정 CTA */}
      <SafeAreaView style={[styles.ctaWrap, { backgroundColor: c.surfaceCard, borderTopColor: c.hairline }]} edges={["bottom"]}>
        <Pressable
          style={[styles.cta, { backgroundColor: c.primary }]}
          onPress={() => nav.navigate("CreateOpinion", { articleId: a.id })}
        >
          <Text style={[styles.ctaText, { color: c.actionOn }]}>내 의견 남기기</Text>
        </Pressable>
      </SafeAreaView>
    </View>
  );
}

// AI 요약 패널 — 3모드(원문요약·기획자관점·쉽게풀기). 캐시 있으면 즉시, 없으면 생성.
const SUMMARY_MODES: { key: SummaryMode; label: string }[] = [
  { key: "plain", label: "원문 요약" },
  { key: "planner", label: "기획자 관점" },
  { key: "explain", label: "쉽게 풀기" },
];

function AiSummaryPanel({
  articleId,
  cached,
}: {
  articleId: string;
  cached: Record<string, string> | null | undefined;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [mode, setMode] = useState<SummaryMode>("plain");
  const [results, setResults] = useState<Record<string, string>>({ ...(cached ?? {}) });
  const req = useRequestArticleSummary(articleId);
  const summary = results[mode];

  const run = (m: SummaryMode) => {
    setMode(m);
    if (results[m]) return;
    req.mutate(m, {
      onSuccess: (s) => {
        if (s) setResults((p) => ({ ...p, [m]: s }));
      },
    });
  };

  return (
    <View style={styles.ai}>
      <View style={styles.aiModes}>
        {SUMMARY_MODES.map((sm) => {
          const on = mode === sm.key;
          return (
            <Pressable
              key={sm.key}
              onPress={() => run(sm.key)}
              style={[
                styles.aiMode,
                { borderColor: on ? c.primary : c.hairline, backgroundColor: on ? c.primaryTint : "transparent" },
              ]}
            >
              <Text style={[styles.aiModeText, { color: on ? c.primary : c.textSecondary }]}>
                {sm.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {req.isPending && !summary ? (
        <View style={styles.aiLoading}>
          <ActivityIndicator color={c.primary} />
          <Text style={[styles.aiHint, { color: c.textMuted }]}>요약을 만들고 있어요…</Text>
        </View>
      ) : summary ? (
        <Text style={[styles.aiText, { color: c.textPrimary }]}>{summary}</Text>
      ) : (
        <Pressable style={[styles.aiRun, { backgroundColor: c.primary }]} onPress={() => run(mode)}>
          <Text style={[styles.aiRunText, { color: c.actionOn }]}>AI 요약 생성</Text>
        </Pressable>
      )}
    </View>
  );
}

// 이 글에 달린 의견 — 미리보기(최대 3개), 탭하면 의견 상세로. (전체 토론은 토론 탭)
function OpinionsSection({ articleId }: { articleId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const q = useOpinions(articleId);
  const list = q.data ?? [];
  if (list.length === 0) return null;
  const preview = list.slice(0, 3);

  return (
    <View style={styles.opinions}>
      <Text style={[styles.opinionsTitle, { color: c.textPrimary }]}>의견 {list.length}</Text>
      {preview.map((o) => (
        <Pressable
          key={o.id}
          onPress={() => nav.navigate("OpinionDetail", { opinionId: o.id })}
          style={({ pressed }) => [
            styles.opinionCard,
            { backgroundColor: c.surfaceCard, borderColor: c.hairline, opacity: pressed ? 0.95 : 1 },
          ]}
        >
          <View style={styles.opinionHead}>
            <Avatar name={o.author?.name ?? "게스트"} size={28} />
            <Text style={[styles.opinionWho, { color: c.textPrimary }]}>
              {o.author?.name ?? "게스트"}
            </Text>
          </View>
          <Text style={[styles.opinionCore, { color: c.textPrimary }]} numberOfLines={3}>
            {o.insight.core}
          </Text>
        </Pressable>
      ))}
      {list.length > preview.length ? (
        <Text style={[styles.opinionMore, { color: c.primary }]}>
          의견 {list.length}개 모두 보기
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingBottom: 24 },

  hero: { width: "100%", aspectRatio: 16 / 9 },
  heroImg: { width: "100%", height: "100%" },

  body: { paddingHorizontal: 16, paddingTop: 16 },
  metaTop: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  readTime: { ...dtype.meta },

  title: { ...dtype.titleL, marginBottom: 12 },

  source: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sourceText: { ...dtype.bodyS, flex: 1 },

  sourceLink: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    marginBottom: 20,
  },
  sourceLinkText: { ...dtype.cardTitle },

  article: { gap: 16 },
  paragraph: { ...dtype.body, lineHeight: 26 },

  tabs: { flexDirection: "row", borderWidth: 1, borderRadius: 12, padding: 3, marginBottom: 16, gap: 3 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: "center" },
  tabText: { ...dtype.cardTitle, fontSize: 14 },

  ai: { gap: 14 },
  aiModes: { flexDirection: "row", gap: 8 },
  aiMode: { flex: 1, borderWidth: 1, borderRadius: 10, paddingVertical: 8, alignItems: "center" },
  aiModeText: { ...dtype.label, fontSize: 12.5 },
  aiLoading: { alignItems: "center", gap: 8, paddingVertical: 24 },
  aiHint: { ...dtype.bodyS },
  aiText: { ...dtype.body, lineHeight: 25 },
  aiRun: { borderRadius: 12, paddingVertical: 13, alignItems: "center", marginTop: 4 },
  aiRunText: { ...dtype.cardTitle },

  opinions: { marginTop: 28, gap: 12 },
  opinionsTitle: { ...dtype.title },
  opinionCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  opinionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  opinionWho: { ...dtype.cardTitle },
  opinionCore: { ...dtype.body, fontWeight: "600" },
  opinionField: { ...dtype.bodyS },
  opinionMore: { ...dtype.cardTitle, paddingVertical: 6 },

  backWrap: { position: "absolute", top: 0, left: 0, paddingHorizontal: 12, paddingTop: 4 },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  ctaWrap: { borderTopWidth: 1, paddingHorizontal: 16, paddingTop: 8 },
  cta: { borderRadius: 12, paddingVertical: 14, alignItems: "center" },
  ctaText: { ...dtype.cardTitle },
});
