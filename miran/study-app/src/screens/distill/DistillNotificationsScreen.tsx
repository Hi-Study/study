// distill 알림 (회의록 §알림) — 즐겨찾기 기업 새 글 · 내 의견 댓글 · 대댓글. 진입 시 읽음 처리.
import React, { useEffect } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft, CornerDownRight, MessageSquare, Newspaper } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import {
  useAppNotifications,
  useMarkAllNotificationsRead,
  type AppNotificationRow,
  type NotificationKind,
} from "@/data";
import { dtype } from "@/theme";
import { relativeDate } from "@/components/distill/ArticleCards";
import { Loading, ErrorState, EmptyState } from "@/components";

const KIND_LABEL: Record<NotificationKind, string> = {
  new_article: "즐겨찾기한 기업의 새 글",
  comment: "내 의견에 댓글이 달렸어요",
  reply: "내 댓글에 답글이 달렸어요",
};

function KindIcon({ kind, color }: { kind: NotificationKind; color: string }) {
  if (kind === "new_article") return <Newspaper size={18} color={color} />;
  if (kind === "reply") return <CornerDownRight size={18} color={color} />;
  return <MessageSquare size={18} color={color} />;
}

export function DistillNotificationsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const q = useAppNotifications();
  const markAll = useMarkAllNotificationsRead();
  const list = q.data ?? [];

  // 진입 시 읽음 처리(회의록 §알림). 한 번만.
  useEffect(() => {
    markAll.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const open = (n: AppNotificationRow) => {
    if (n.kind === "new_article" && n.article_id) {
      nav.navigate("ArticleDetail", { articleId: n.article_id });
    } else if (n.opinion_id) {
      nav.navigate("OpinionDetail", { opinionId: n.opinion_id });
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.backBtn}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.textPrimary }]}>알림</Text>
        <View style={{ width: 24 }} />
      </View>

      {q.isLoading ? (
        <Loading label="불러오는 중…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="새 알림이 없어요" hint="기업을 즐겨찾기하면 새 글 알림을 받아요" />
      ) : (
        <FlatList
          data={list}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshing={q.isRefetching}
          onRefresh={() => q.refetch()}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => open(item)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: item.read ? c.surfaceCard : c.primaryTint,
                  borderColor: c.hairline,
                  opacity: pressed ? 0.95 : 1,
                },
              ]}
            >
              <View style={[styles.iconWrap, { backgroundColor: c.surfaceSunken }]}>
                <KindIcon kind={item.kind} color={c.primary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.label, { color: c.textSecondary }]}>{KIND_LABEL[item.kind]}</Text>
                {item.title ? (
                  <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={2}>
                    {item.title}
                  </Text>
                ) : null}
                <Text style={[styles.time, { color: c.textMuted }]}>{relativeDate(item.created_at)}</Text>
              </View>
              {!item.read ? <View style={[styles.dot, { backgroundColor: c.primary }]} /> : null}
            </Pressable>
          )}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { width: 24, alignItems: "flex-start" },
  headerTitle: { ...dtype.title },

  listContent: { padding: 16 },
  row: { flexDirection: "row", gap: 12, alignItems: "center", borderWidth: 1, borderRadius: 16, padding: 14 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  label: { ...dtype.meta, fontWeight: "700" },
  title: { ...dtype.bodyS, fontWeight: "600", marginTop: 3, lineHeight: 20 },
  time: { ...dtype.meta, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
