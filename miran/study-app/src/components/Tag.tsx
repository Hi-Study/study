import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";

type TagKind = "owner" | "active" | "host" | "muted";

/**
 * 소형 태그/배지.
 *  - owner  : "방장" (cream 배경 + 어버진 텍스트)
 *  - active : "진행 중" (어버진 pill)
 *  - host   : "주최" (라벤더 배경 + 어버진)
 *  - muted  : 회색 정보 태그
 */
export function Tag({
  label,
  kind = "muted",
  style,
}: {
  label: string;
  kind?: TagKind;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  const palette: Record<TagKind, { bg: string; fg: string; radius: number }> = {
    owner: { bg: c.canvasParchment, fg: c.primary, radius: 4 },
    active: { bg: c.primary, fg: c.actionOn, radius: 90 },
    host: { bg: c.tintLavender, fg: c.primary, radius: 3 },
    muted: { bg: c.canvasParchment, fg: c.textMuted, radius: 4 },
  };
  const p = palette[kind];

  return (
    <View style={[styles.tag, { backgroundColor: p.bg, borderRadius: p.radius }, style]}>
      <Text style={[styles.label, { color: p.fg }]}>{label}</Text>
    </View>
  );
}

/** 안읽음 빨간 점(8×8, #e03e3e). */
export function RedDot({ size = 8 }: { size?: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: "#e03e3e",
      }}
    />
  );
}

const styles = StyleSheet.create({
  tag: { paddingHorizontal: 7, paddingVertical: 2, alignSelf: "flex-start" },
  label: { fontSize: 11, fontWeight: "600" },
});
