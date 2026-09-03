// distill 아티클 표현 컴포넌트 — 서비스 로고 · 주제칩 · 가로 캐러셀 카드 · 리스트 행 · 피처드.
// DESIGN_GUIDE §6.5(아티클 카드)·§6.6(서비스 로고칩)·§6.7(주제칩) 기준.
import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Bookmark, Eye, MessageSquare } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { TOPIC_META, dtype , PRETENDARD} from "@/theme";
import { ArticleThumb } from "./ArticleThumb";
import { ServiceLogo } from "./ServiceLogo";
import { safeImageUri } from "@/lib/image";
import { useIsBookmarked, useToggleBookmark } from "@/data";
import { ImprovementTag } from "./ImprovementTag";
import type { ArticleWithBlog } from "@/data/articles";
import type { Topic } from "@/types/database";

// 큰 수 축약(1200 → 1.2k).
function fmtCount(n: number | null | undefined): string {
  const v = n ?? 0;
  return v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : String(v);
}

// 조회수·인사이트 수 (카드 지표). — DESIGN_SYSTEM §5 카드
function CardStats({ article }: { article: ArticleWithBlog }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.statsRow}>
      <Eye size={13} color={c.textMuted} />
      <Text style={[styles.statText, { color: c.textMuted }]}>{fmtCount(article.view_count)}</Text>
      <MessageSquare size={13} color={c.textMuted} style={{ marginLeft: 8 }} />
      <Text style={[styles.statText, { color: c.textMuted }]}>{fmtCount(article.opinion_count)}</Text>
    </View>
  );
}

// 카드 북마크 토글 버튼.
function CardBookmark({ articleId }: { articleId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const bookmarked = useIsBookmarked(articleId);
  const toggle = useToggleBookmark(articleId);
  const on = bookmarked.data ?? false;
  return (
    <Pressable
      onPress={() => toggle.mutate(!on)}
      disabled={toggle.isPending}
      hitSlop={8}
      style={styles.bmBtn}
    >
      <Bookmark size={18} color={on ? c.primary : c.textMuted} fill={on ? c.primary : "transparent"} />
    </Pressable>
  );
}

// ---- 유틸 ----
export function relativeDate(iso: string | null): string {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (isNaN(t)) return "";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return `${days}일 전`;
  if (days < 30) return `${Math.floor(days / 7)}주 전`;
  if (days < 365) return `${Math.floor(days / 30)}개월 전`;
  return `${Math.floor(days / 365)}년 전`;
}

// ---- 서비스 로고칩 — 브랜드 파비콘(기업 아이콘), 없거나 실패 시 브랜드색+이니셜 ----
// blogKey 로 브랜드 도메인을 우선 해석(네이버 계열 통일·Medium 호스팅 보정). brandIcon.ts 참고.
export { ServiceLogo };

// ---- 주제칩 ----
export function TopicChip({ topic }: { topic: Topic }) {
  const meta = TOPIC_META[topic];
  if (!meta) return null;
  return (
    <View style={[styles.topicChip, { backgroundColor: meta.tint }]}>
      <Text style={[styles.topicText, { color: meta.color }]}>{meta.label}</Text>
    </View>
  );
}

// 주제칩(누가 쓴 글이냐) + 개선 유형 태그(무엇을 개선했냐) 한 줄.
//   두 축을 나란히 둔다. 카드 단계에서 "이 글이 내가 찾던 사례인지"를 고르게 하는 게 목적.
function CardChips({ article }: { article: ArticleWithBlog }) {
  return (
    <View style={styles.chipRow}>
      {article.topic != null ? <TopicChip topic={article.topic} /> : null}
      <ImprovementTag
        decision={article.decision}
        title={article.title}
        tags={article.tags}
        readMinutes={article.read_minutes}
      />
    </View>
  );
}

// ---- 출처 로고칩 + 이름 + 날짜 메타 라인 ----
function MetaLine({ article }: { article: ArticleWithBlog }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.metaRow}>
      <ServiceLogo
        name={article.blog?.name ?? "?"}
        brandColor={article.blog?.brand_color}
        homepage={article.blog?.homepage}
        blogKey={article.blog?.key}
        size={18}
      />
      <Text style={[styles.metaText, { color: c.textMuted }]} numberOfLines={1}>
        {article.blog?.name ?? ""}
        {article.published_at ? ` · ${relativeDate(article.published_at)}` : ""}
      </Text>
      <CardStats article={article} />
    </View>
  );
}

// ---- 가로 캐러셀 카드(이미지 상단 + 제목/메타) — §6.5 ----
export function ArticleCardH({
  article,
  onPress,
  width = 260,
}: {
  article: ArticleWithBlog;
  onPress: () => void;
  width?: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cardH,
        { width, backgroundColor: c.surfaceCard, borderColor: c.hairline, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <ArticleThumb article={article} style={styles.thumbH}>
        <View style={[styles.bmOverlay, { backgroundColor: c.surfaceCard }]}>
          <CardBookmark articleId={article.id} />
        </View>
      </ArticleThumb>
      <View style={styles.cardHBody}>
        <CardChips article={article} />
        <Text style={[styles.cardTitle, { color: c.textPrimary }]} numberOfLines={2}>
          {article.title}
        </Text>
        <MetaLine article={article} />
      </View>
    </Pressable>
  );
}

// ---- 리스트 행(썸네일 좌 + 텍스트 우) — §6.5 ----
export function ArticleRow({
  article,
  onPress,
}: {
  article: ArticleWithBlog;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={styles.rowText}>
        <CardChips article={article} />
        <Text style={[styles.rowTitle, { color: c.textPrimary }]} numberOfLines={2}>
          {article.title}
        </Text>
        <MetaLine article={article} />
      </View>
      <ArticleThumb article={article} style={styles.thumbRow}>
        <View style={[styles.bmOverlay, { backgroundColor: c.surfaceCard }]}>
          <CardBookmark articleId={article.id} />
        </View>
      </ArticleThumb>
    </Pressable>
  );
}

// ---- 피처드(대형 히어로) — 홈 상단 대표글 ----
export function FeaturedCard({
  article,
  onPress,
}: {
  article: ArticleWithBlog;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.featured,
        { backgroundColor: c.surfaceCard, borderColor: c.hairline, opacity: pressed ? 0.95 : 1 },
      ]}
    >
      <ArticleThumb article={article} style={styles.featuredThumb}>
        <View style={[styles.bmOverlay, { backgroundColor: c.surfaceCard }]}>
          <CardBookmark articleId={article.id} />
        </View>
      </ArticleThumb>
      <View style={styles.featuredBody}>
        <CardChips article={article} />
        <Text style={[styles.featuredTitle, { color: c.textPrimary }]} numberOfLines={2}>
          {article.title}
        </Text>
        <MetaLine article={article} />
      </View>
    </Pressable>
  );
}

// ---- 그리드 카드(2열) — 썸네일 상단 + 제목/메타. 썸네일 없으면 브랜드 로고로 채워 빈칸 방지 ----
export function ArticleGridCard({
  article,
  onPress,
  width,
}: {
  article: ArticleWithBlog;
  onPress: () => void;
  width: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.gridCard,
        { width, backgroundColor: c.surfaceCard, borderColor: c.hairline, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <ArticleThumb article={article} style={styles.gridThumb}>
        <View style={[styles.bmOverlay, { backgroundColor: c.surfaceCard }]}>
          <CardBookmark articleId={article.id} />
        </View>
      </ArticleThumb>
      <View style={styles.gridBody}>
        <CardChips article={article} />
        <Text style={[styles.gridTitle, { color: c.textPrimary }]} numberOfLines={2}>
          {article.title}
        </Text>
        <MetaLine article={article} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: "center", justifyContent: "center" },
  logoText: { color: "#fff", fontWeight: "800", fontFamily: PRETENDARD["800"] },
  favicon: { alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", overflow: "hidden" },

  topicChip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  topicText: { ...dtype.label },

  chipRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  metaText: { ...dtype.meta, flex: 1 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { ...dtype.meta, fontWeight: "600", fontFamily: PRETENDARD["600"] },

  bmBtn: { width: 30, height: 30, alignItems: "center", justifyContent: "center" },
  bmOverlay: {
    position: "absolute",
    top: 6,
    right: 6,
    borderRadius: 999,
    opacity: 0.94,
  },

  cardH: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  thumbH: { width: "100%", aspectRatio: 16 / 9 },
  thumbImg: { width: "100%", height: "100%" },
  cardHBody: { padding: 12, gap: 6 },
  cardTitle: { ...dtype.cardTitle },

  row: { flexDirection: "row", gap: 12, paddingVertical: 14, alignItems: "flex-start" },
  rowText: { flex: 1, gap: 6 },
  rowTitle: { ...dtype.cardTitle },
  thumbRow: { width: 84, height: 84, borderRadius: 12, overflow: "hidden" },

  featured: { borderRadius: 16, borderWidth: 1, overflow: "hidden" },
  featuredThumb: { width: "100%", aspectRatio: 2 },
  featuredBody: { padding: 16, gap: 8 },
  featuredTitle: { ...dtype.titleL },

  gridCard: { borderRadius: 14, borderWidth: 1, overflow: "hidden" },
  gridThumb: { width: "100%", aspectRatio: 16 / 9, alignItems: "center", justifyContent: "center" },
  gridBody: { padding: 10, gap: 6 },
  gridTitle: { ...dtype.cardTitle, fontSize: 14 },
});
