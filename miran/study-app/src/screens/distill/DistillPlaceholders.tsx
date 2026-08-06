// distill 탭 자리표시 — 피드/토론/검색/마이는 다음 단계에서 구현. 지금은 안내 화면.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype } from "@/theme";

function Placeholder({ title, hint }: { title: string; hint: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      <View style={styles.center}>
        <Text style={[styles.title, { color: c.textPrimary }]}>{title}</Text>
        <Text style={[styles.hint, { color: c.textMuted }]}>{hint}</Text>
      </View>
    </SafeAreaView>
  );
}

export const FeedScreen = () => (
  <Placeholder title="피드" hint="주제별 테크 글을 큐레이션해서 보여줄 화면이에요. 곧 준비돼요." />
);
export const DiscussScreen = () => (
  <Placeholder title="토론" hint="사람들의 의견과 토론을 모아보는 화면이에요. 곧 준비돼요." />
);
export const DistillSearchScreen = () => (
  <Placeholder title="검색" hint="글·의견을 서비스·주제·태그로 찾는 화면이에요. 곧 준비돼요." />
);
export const DistillMyPageScreen = () => (
  <Placeholder title="마이" hint="내 의견·저장·관심 주제를 관리하는 화면이에요. 곧 준비돼요." />
);

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, padding: 32 },
  title: { ...dtype.titleL },
  hint: { ...dtype.body, textAlign: "center", lineHeight: 22 },
});
