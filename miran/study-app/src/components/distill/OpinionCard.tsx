// distill 의견 카드 — 핵심 인사이트 + 작성자 + 출처 글 (DESIGN_GUIDE §6.9, 일반 카드/강조바 없음).
import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { Heart } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype , PRETENDARD} from "@/theme";
import { Avatar } from "@/components/Avatar";
import { ServiceLogo, TopicChip, relativeDate } from "@/components/distill/ArticleCards";
import { InsightBody } from "@/components/distill/InsightBody";
import type { OpinionFeedItem } from "@/data/opinions";

export function OpinionCard({
  opinion,
  onPress,
  onAuthorPress,
}: {
  opinion: OpinionFeedItem;
  onPress: () => void;
  onAuthorPress?: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const a = opinion.article;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.surfaceCard, borderColor: c.hairline, opacity: pressed ? 0.95 : 1 },
      ]}
    >
      {/* 작성자(탭하면 인사이터 프로필) + 메타 */}
      <View style={styles.head}>
        <Pressable
          style={styles.headAuthor}
          onPress={onAuthorPress}
          disabled={!onAuthorPress}
          hitSlop={4}
        >
          <Avatar name={opinion.author?.name ?? "게스트"} size={36} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.who, { color: c.textPrimary }]}>
              {opinion.author?.name ?? "게스트"}
            </Text>
            {opinion.author?.role_title ? (
              <Text style={[styles.role, { color: c.textMuted }]}>{opinion.author.role_title}</Text>
            ) : null}
          </View>
        </Pressable>
        <View style={styles.headRight}>
          <Text style={[styles.date, { color: c.textMuted }]}>{relativeDate(opinion.created_at)}</Text>
          <View style={styles.likeMeta}>
            <Heart size={12} color={c.textMuted} />
            <Text style={[styles.likeNum, { color: c.textMuted }]}>{opinion.like_count ?? 0}</Text>
          </View>
        </View>
      </View>

      {/* 인사이트 — 작성한 항목 전부를 타이틀+내용으로(항목별 3줄까지 미리보기) */}
      <InsightBody insight={opinion.insight} compact />

      {/* 출처 글 */}
      {a ? (
        <View style={[styles.source, { backgroundColor: c.surfaceSunken }]}>
          {a.og_image ? (
            <Image source={{ uri: a.og_image }} style={styles.sourceThumb} resizeMode="cover" />
          ) : (
            <ServiceLogo name={a.blog?.name ?? "?"} brandColor={a.blog?.brand_color} homepage={a.blog?.homepage} blogKey={a.blog?.key} size={36} />
          )}
          <View style={{ flex: 1 }}>
            {a.topic ? <TopicChip topic={a.topic} /> : null}
            <Text style={[styles.sourceTitle, { color: c.textSecondary }]} numberOfLines={2}>
              {a.title}
            </Text>
            <Text style={[styles.sourceBlog, { color: c.textMuted }]}>{a.blog?.name ?? ""}</Text>
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  headAuthor: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  who: { ...dtype.cardTitle },
  role: { ...dtype.meta },
  headRight: { alignItems: "flex-end", gap: 3 },
  date: { ...dtype.meta },
  likeMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  likeNum: { ...dtype.meta, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  source: { flexDirection: "row", gap: 10, padding: 10, borderRadius: 12, alignItems: "center" },
  sourceThumb: { width: 44, height: 44, borderRadius: 8 },
  sourceTitle: { ...dtype.bodyS, fontWeight: "600", fontFamily: PRETENDARD["600"], marginTop: 2 },
  sourceBlog: { ...dtype.meta, marginTop: 2 },
});
