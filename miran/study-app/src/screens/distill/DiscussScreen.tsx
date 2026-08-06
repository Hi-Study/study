// distill 토론 탭 — 사람들의 의견(핵심 인사이트)을 모아보고 토론으로 진입 (DESIGN_GUIDE §7.2b).
import React from "react";
import { FlatList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useOpinionsFeed } from "@/data";
import { dtype } from "@/theme";
import { OpinionCard } from "@/components/distill/OpinionCard";
import { Loading, ErrorState, EmptyState } from "@/components";

export function DiscussScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const q = useOpinionsFeed();
  const list = q.data ?? [];

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: c.textPrimary }]}>토론</Text>
        <Text style={[styles.sub, { color: c.textMuted }]}>사람들의 인사이트와 토론</Text>
      </View>

      {q.isLoading ? (
        <Loading label="불러오는 중…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="아직 의견이 없어요" hint="글을 읽고 첫 의견을 남겨보세요" />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => (
            <OpinionCard
              opinion={item}
              onPress={() => nav.navigate("OpinionDetail", { opinionId: item.id })}
            />
          )}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          showsVerticalScrollIndicator={false}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 12 },
  title: { ...dtype.display },
  sub: { ...dtype.body, marginTop: 2 },
  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
});
