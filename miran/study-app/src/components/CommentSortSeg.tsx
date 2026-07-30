import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import type { CommentSort } from "@/lib/sortComments";

/** 댓글 정렬 토글(등록순 / 좋아요순). */
export function CommentSortSeg({
  value,
  onChange,
}: {
  value: CommentSort;
  onChange: (m: CommentSort) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const opt = (m: CommentSort, label: string) => {
    const on = value === m;
    return (
      <Pressable onPress={() => onChange(m)} hitSlop={6}>
        <Text
          style={[
            styles.txt,
            { color: on ? c.primary : c.textMuted, fontWeight: on ? "700" : "500" },
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };
  return (
    <View style={styles.row}>
      {opt("recent", "등록순")}
      {opt("likes", "좋아요순")}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: 10 },
  txt: { fontSize: 12 },
});
