import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { LogOut } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useSetTheme } from "@/data/profile";
import { signOut } from "@/auth/googleSignIn";
import { Screen, ScreenHeader, SectionLabel } from "@/components/Chrome";
import type { ThemeMode } from "@/theme";

export function DisplaySettingsScreen() {
  const { theme, mode, setOverride } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const setTheme = useSetTheme();

  function choose(next: ThemeMode) {
    if (next === mode) return;
    setOverride(next); // 즉시 앱 전체 반영
    setTheme.mutate(next); // 서버(users.theme) 영속
  }

  function confirmSignOut() {
    Alert.alert("로그아웃", "로그아웃할까요?", [
      { text: "취소", style: "cancel" },
      { text: "로그아웃", style: "destructive", onPress: () => void signOut() },
    ]);
  }

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader title="설정" onBack={() => nav.goBack()} />

      <SectionLabel>화면 모드</SectionLabel>
      <View style={styles.row}>
        <Opt label="낮" swatchBg="#fff" swatchFg="#000" on={mode === "light"} onPress={() => choose("light")} />
        <Opt label="밤" swatchBg="#000" swatchFg="#fff" on={mode === "dark"} onPress={() => choose("dark")} />
      </View>
      <Text style={[styles.hint, { color: c.textMuted }]}>
        선택한 화면 모드는 앱 전체에 즉시 적용됩니다.
      </Text>

      <SectionLabel>계정</SectionLabel>
      <Pressable
        onPress={confirmSignOut}
        style={[styles.accountRow, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
      >
        <Text style={[styles.accountText, { color: c.danger }]}>로그아웃</Text>
        <LogOut size={18} color={c.danger} />
      </Pressable>
    </Screen>
  );
}

function Opt({
  label,
  swatchBg,
  swatchFg,
  on,
  onPress,
}: {
  label: string;
  swatchBg: string;
  swatchFg: string;
  on: boolean;
  onPress: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.opt,
        {
          backgroundColor: c.surfaceCard,
          borderColor: on ? c.primaryFocus : c.hairline,
          borderWidth: on ? 2 : 1,
        },
      ]}
    >
      <View style={[styles.swatch, { backgroundColor: swatchBg, borderColor: c.hairline }]}>
        <Text style={{ color: swatchFg, fontSize: 13, fontWeight: "600" }}>Aa</Text>
      </View>
      <Text style={{ fontSize: 14, fontWeight: "600", color: on ? c.primary : c.textPrimary }}>
        {label} 모드
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  row: { flexDirection: "row", gap: 12 },
  opt: { flex: 1, paddingVertical: 18, borderRadius: 12, alignItems: "center", gap: 10 },
  swatch: {
    width: 56,
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: { fontSize: 13, marginTop: 6, marginHorizontal: 4, lineHeight: 20 },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
  },
  accountText: { fontSize: 15, fontWeight: "600" },
});
