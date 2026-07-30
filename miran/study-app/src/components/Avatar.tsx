import { StyleSheet, Text, View, type ViewStyle } from "react-native";

import { nameHashColor, initial } from "@/lib/color";

interface AvatarProps {
  name: string | null | undefined;
  size?: number;
  /** 스터디 타일은 라운드 사각(8px), 사람 아바타는 원형. */
  square?: boolean;
  style?: ViewStyle;
}

/** 이름 해시 색 + 이니셜 아바타. (design/README 공유 카드·스터디 타일 공용) */
export function Avatar({ name, size = 30, square = false, style }: AvatarProps) {
  return (
    <View
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: square ? 8 : size / 2,
          backgroundColor: nameHashColor(name ?? "?"),
        },
        style,
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.44 }]}>
        {initial(name)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { alignItems: "center", justifyContent: "center" },
  text: { color: "#ffffff", fontWeight: "700" },
});
