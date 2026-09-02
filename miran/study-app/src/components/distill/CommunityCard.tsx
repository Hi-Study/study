// 커뮤니티 자유글 카드 — 인사이트 탭(커뮤니티 서브탭)과 홈 캐러셀이 같이 쓴다.
//   작성자 + 제목 + 내용 미리보기 + 좋아요/댓글 수. 탭하면 자유글 상세로.
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Heart, MessageSquare } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype , PRETENDARD} from "@/theme";
import type { CommunityPost } from "@/data/community";
import { Avatar } from "@/components/Avatar";
import { relativeDate } from "@/components/distill/ArticleCards";
import { InsightBody, type InsightData } from "@/components/distill/InsightBody";

export function CommunityCard({
  post,
  onPress,
  bodyLines = 3,
}: {
  post: CommunityPost;
  onPress: () => void;
  /** 홈 캐러셀처럼 높이를 맞춰야 할 때 줄 수를 줄인다. */
  bodyLines?: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.surfaceCard, borderColor: c.hairline, opacity: pressed ? 0.95 : 1 },
      ]}
    >
      <View style={styles.head}>
        <Avatar name={post.author?.name ?? "게스트"} size={28} />
        <Text style={[styles.author, { color: c.textSecondary }]} numberOfLines={1}>
          {post.author?.name ?? "게스트"}
        </Text>
        <Text style={[styles.date, { color: c.textMuted }]}>{relativeDate(post.created_at)}</Text>
      </View>

      <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={2}>
        {post.title}
      </Text>

      {/* 자유글은 제목+내용. (insight 는 예전에 감상문 폼으로 쓴 글만 있는 레거시 폴백) */}
      {post.body ? (
        <Text style={[styles.body, { color: c.textSecondary }]} numberOfLines={bodyLines}>
          {post.body}
        </Text>
      ) : (post.insight as { core?: string })?.core ? (
        <InsightBody insight={post.insight as InsightData} compact />
      ) : null}

      <View style={styles.meta}>
        <Heart size={13} color={c.textMuted} />
        <Text style={[styles.metaText, { color: c.textMuted }]}>{post.like_count ?? 0}</Text>
        <MessageSquare size={13} color={c.textMuted} style={{ marginLeft: 10 }} />
        <Text style={[styles.metaText, { color: c.textMuted }]}>{post.comment_count ?? 0}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 8 },
  author: { ...dtype.label, fontSize: 13, flex: 1 },
  date: { ...dtype.meta },
  title: { ...dtype.cardTitle, fontSize: 15 },
  body: { ...dtype.bodyS, lineHeight: 20 },
  meta: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  metaText: { ...dtype.meta, fontWeight: "600", fontFamily: PRETENDARD["600"] },
});
