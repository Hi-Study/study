// distill 아티클 표현 컴포넌트 — 서비스 로고 · 주제칩 · 가로 캐러셀 카드 · 리스트 행 · 피처드.
// DESIGN_GUIDE §6.5(아티클 카드)·§6.6(서비스 로고칩)·§6.7(주제칩) 기준.
import React, { useMemo, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { TOPIC_META, dtype } from "@/theme";
import { readingMinutes } from "@/lib/text";
import { faviconDomain, faviconUrl } from "@/lib/brandIcon";
import { safeImageUri } from "@/lib/image";
import type { ArticleWithBlog } from "@/data/articles";
import type { Topic } from "@/types/database";

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
export function ServiceLogo({
  name,
  brandColor,
  size = 44,
  homepage,
  blogKey,
}: {
  name: string;
  brandColor?: string | null;
  size?: number;
  homepage?: string | null;
  blogKey?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  const domain = useMemo(() => faviconDomain(blogKey, homepage), [blogKey, homepage]);

  if (domain && !failed) {
    return (
      <View
        style={[
          styles.favicon,
          { width: size, height: size, borderRadius: size * 0.28 },
        ]}
      >
        <Image
          source={{ uri: faviconUrl(domain) }}
          style={{ width: size * 0.66, height: size * 0.66 }}
          resizeMode="contain"
          onError={() => setFailed(true)}
        />
      </View>
    );
  }

  const bg = brandColor ?? "#4F46E5";
  return (
    <View
      style={[
        styles.logo,
        { width: size, height: size, borderRadius: size * 0.28, backgroundColor: bg },
      ]}
    >
      <Text style={[styles.logoText, { fontSize: size * 0.4 }]}>{name.slice(0, 1)}</Text>
    </View>
  );
}

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

// ---- 출처 로고칩 + 이름 + 날짜 메타 라인 ----
function MetaLine({ article }: { article: ArticleWithBlog }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const mins = readingMinutes(article.body);
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
        {mins ? ` · ${mins}분` : ""}
      </Text>
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
      <View style={[styles.thumbH, { backgroundColor: c.surfaceSunken }]}>
        {article.og_image ? (
          <Image source={{ uri: safeImageUri(article.og_image) }} style={styles.thumbImg} resizeMode="cover" />
        ) : null}
      </View>
      <View style={styles.cardHBody}>
        {article.topic ? <TopicChip topic={article.topic} /> : null}
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
        {article.topic ? <TopicChip topic={article.topic} /> : null}
        <Text style={[styles.rowTitle, { color: c.textPrimary }]} numberOfLines={2}>
          {article.title}
        </Text>
        <MetaLine article={article} />
      </View>
      <View style={[styles.thumbRow, { backgroundColor: c.surfaceSunken }]}>
        {article.og_image ? (
          <Image source={{ uri: safeImageUri(article.og_image) }} style={styles.thumbImg} resizeMode="cover" />
        ) : null}
      </View>
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
      <View style={[styles.featuredThumb, { backgroundColor: c.surfaceSunken }]}>
        {article.og_image ? (
          <Image source={{ uri: safeImageUri(article.og_image) }} style={styles.thumbImg} resizeMode="cover" />
        ) : null}
      </View>
      <View style={styles.featuredBody}>
        {article.topic ? <TopicChip topic={article.topic} /> : null}
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
      <View style={[styles.gridThumb, { backgroundColor: c.surfaceSunken }]}>
        {article.og_image ? (
          <Image source={{ uri: safeImageUri(article.og_image) }} style={styles.thumbImg} resizeMode="cover" />
        ) : (
          <ServiceLogo
            name={article.blog?.name ?? "?"}
            brandColor={article.blog?.brand_color}
            homepage={article.blog?.homepage}
            blogKey={article.blog?.key}
            size={34}
          />
        )}
      </View>
      <View style={styles.gridBody}>
        {article.topic ? <TopicChip topic={article.topic} /> : null}
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
  logoText: { color: "#fff", fontWeight: "800" },
  favicon: { alignItems: "center", justifyContent: "center", backgroundColor: "#fff", borderWidth: 1, borderColor: "rgba(0,0,0,0.06)", overflow: "hidden" },

  topicChip: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  topicText: { ...dtype.label },

  metaRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 8 },
  metaText: { ...dtype.meta, flex: 1 },

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
