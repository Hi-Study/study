// distill 마이 탭 (DESIGN_GUIDE §7.6) — 프로필 · 내 의견 · 설정.
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronRight, Settings } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useMyOpinions } from "@/data";
import { dtype } from "@/theme";
import { Avatar } from "@/components/Avatar";
import { OpinionCard } from "@/components/distill/OpinionCard";
import { Loading, EmptyState } from "@/components";

export function DistillMyPageScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const q = useMyOpinions();
  const mine = q.data ?? [];

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      <FlatList
        data={mine}
        keyExtractor={(o) => o.id}
        renderItem={({ item }) => (
          <OpinionCard
            opinion={item}
            onPress={() => nav.navigate("OpinionDetail", { opinionId: item.id })}
          />
        )}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View>
            {/* 프로필 */}
            <View style={styles.profile}>
              <Avatar name="게스트" size={56} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { color: c.textPrimary }]}>게스트</Text>
                <Text style={[styles.role, { color: c.textMuted }]}>읽고 생각을 남기는 중</Text>
              </View>
              <Pressable
                hitSlop={8}
                style={styles.iconBtn}
                onPress={() => nav.navigate("DisplaySettings")}
              >
                <Settings size={22} color={c.textSecondary} />
              </Pressable>
            </View>

            {/* 통계 */}
            <View style={styles.stats}>
              <View style={[styles.statCard, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
                <Text style={[styles.statNum, { color: c.textPrimary }]}>{mine.length}</Text>
                <Text style={[styles.statLabel, { color: c.textMuted }]}>내 의견</Text>
              </View>
            </View>

            {/* 설정 바로가기 */}
            <Pressable
              style={[styles.menuRow, { borderColor: c.hairline }]}
              onPress={() => nav.navigate("DisplaySettings")}
            >
              <Text style={[styles.menuText, { color: c.textPrimary }]}>화면 설정 (테마)</Text>
              <ChevronRight size={18} color={c.textMuted} />
            </Pressable>

            <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>내 의견</Text>
            {q.isLoading ? <Loading label="불러오는 중…" /> : null}
            {!q.isLoading && mine.length === 0 ? (
              <EmptyState title="아직 남긴 의견이 없어요" hint="글을 읽고 첫 의견을 남겨보세요" />
            ) : null}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },

  profile: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 12, paddingBottom: 16 },
  name: { ...dtype.titleL },
  role: { ...dtype.bodyS, marginTop: 2 },
  iconBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  stats: { flexDirection: "row", gap: 12, marginBottom: 16 },
  statCard: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 16, alignItems: "center", gap: 4 },
  statNum: { ...dtype.display, fontSize: 24 },
  statLabel: { ...dtype.meta },

  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 24,
  },
  menuText: { ...dtype.cardTitle },
  sectionTitle: { ...dtype.title, marginBottom: 12 },
});
