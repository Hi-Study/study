import { Pressable, StyleSheet, Text, View } from "react-native";
import { MessageSquare } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import type { DiscussionWithMeta } from "@/data/discussions";
import { RedDot, Tag } from "./Tag";

/** 토론 목록 행(홈/검색 공용). 미참여 진행 토론은 강조 + 빨간 점. */
export function DiscussionRows({
  rows,
  onOpen,
}: {
  rows: DiscussionWithMeta[];
  onOpen: (id: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.list}>
      {rows.map((d) => {
        const notJoined = d.is_active && !d.participated;
        return (
          <Pressable
            key={d.id}
            onPress={() => onOpen(d.id)}
            style={({ pressed }) => [styles.row, pressed && { backgroundColor: c.surfacePageAlt }]}
          >
            <View style={[styles.tile, { backgroundColor: d.is_active ? c.primary : c.canvasParchment }]}>
              <MessageSquare size={20} color={d.is_active ? "#fff" : c.textMuted} />
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.titleLine}>
                <Text
                  numberOfLines={1}
                  style={[styles.title, { color: c.textPrimary, fontWeight: notJoined ? "800" : "600" }]}
                >
                  {d.title}
                </Text>
                {d.is_active ? <Tag label="진행 중" kind="active" /> : null}
              </View>
              {d.prompt ? (
                <Text numberOfLines={1} style={[styles.prompt, { color: notJoined ? c.textSecondary : c.textMuted }]}>
                  {d.prompt}
                </Text>
              ) : null}
              <Text style={[styles.count, { color: c.textMuted }]}>답글 {d.commentCount}</Text>
            </View>
            <View style={styles.rightCol}>
              <Text style={[styles.week, { color: c.textMuted }]}>{d.week_label}</Text>
              {notJoined ? <RedDot size={9} /> : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { marginHorizontal: -6, gap: 2 },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 10, borderRadius: 8 },
  tile: { width: 40, height: 40, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  titleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { fontSize: 15.5, letterSpacing: -0.3, flexShrink: 1 },
  prompt: { fontSize: 13, marginTop: 2 },
  count: { fontSize: 12, marginTop: 6 },
  rightCol: { alignItems: "flex-end", gap: 5 },
  week: { fontSize: 11 },
});
