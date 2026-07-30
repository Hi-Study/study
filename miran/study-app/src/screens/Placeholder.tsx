import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";

/**
 * 아직 구현되지 않은 화면용 임시 표시. 네비게이션이 실제로 동작하도록
 * 모든 화면을 등록하되, 미구현 화면은 이 컴포넌트로 대체한다.
 * (개발 순서대로 하나씩 실제 화면으로 교체 예정)
 */
export function Placeholder({ title }: { title: string }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.colors.surfacePage }]}>
      <Text style={[styles.title, { color: theme.colors.textSecondary }]}>
        {title}
      </Text>
      <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
        아직 구현 전이에요 · 다음 단계에서 만들어집니다
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8, padding: 24 },
  title: { fontSize: 17, fontWeight: "700" },
  hint: { fontSize: 13, textAlign: "center" },
});
