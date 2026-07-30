import { Pressable, StyleSheet, Text, View } from "react-native";
import { Heart, MessageCircle } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { Avatar } from "./Avatar";
import type { ShareWithMeta } from "@/data/shares";

/** 공유 글 카드(Slack 채널 행 스타일). 달력/이번 주 목록 공용. */
export function ShareCard({
  share,
  onPress,
}: {
  share: ShareWithMeta;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const name = share.author?.name ?? "알 수 없음";
  const role = share.author?.role_title || "멤버";
  const source = share.source || (share.kind === "text" ? "직접 작성" : "링크");
  const preview = share.note || share.body || "";

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.colors.surfacePageAlt },
      ]}
    >
      <Avatar name={name} size={38} square />
      <View style={{ flex: 1 }}>
        <View style={styles.metaLine}>
          <Text style={[styles.name, { color: theme.colors.textPrimary }]}>
            {name}
          </Text>
          <Text style={[styles.meta, { color: theme.colors.textMuted }]}>
            {role} · {source}
          </Text>
        </View>
        <Text
          numberOfLines={1}
          style={[styles.title, { color: theme.colors.textPrimary }]}
        >
          {share.title}
        </Text>
        {preview ? (
          <Text
            numberOfLines={1}
            style={[styles.preview, { color: theme.colors.textSecondary }]}
          >
            {preview}
          </Text>
        ) : null}
        {share.tags && share.tags.length > 0 ? (
          <View style={styles.tags}>
            {share.tags.slice(0, 4).map((t) => (
              <View key={t} style={[styles.tag, { backgroundColor: theme.colors.tintLavender }]}>
                <Text style={[styles.tagText, { color: theme.colors.primary }]}>#{t}</Text>
              </View>
            ))}
          </View>
        ) : null}
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Heart size={14} color="#e0245e" fill="#e0245e" />
            <Text style={[styles.statText, { color: theme.colors.textMuted }]}>
              {share.likeCount}
            </Text>
          </View>
          <View style={styles.stat}>
            <MessageCircle size={14} color={theme.colors.textMuted} />
            <Text style={[styles.statText, { color: theme.colors.textMuted }]}>
              {share.commentCount}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 8,
  },
  metaLine: { flexDirection: "row", alignItems: "baseline", gap: 6, flexWrap: "wrap" },
  name: { fontSize: 14.5, fontWeight: "700" },
  meta: { fontSize: 11.5 },
  title: { fontSize: 15, fontWeight: "600", marginTop: 2 },
  preview: { fontSize: 13, marginTop: 2 },
  tags: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 6 },
  tag: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: 90,
  },
  tagText: { fontSize: 11, fontWeight: "700" },
  stats: { flexDirection: "row", gap: 12, marginTop: 7 },
  stat: { flexDirection: "row", alignItems: "center", gap: 3 },
  statText: { fontSize: 12 },
});
