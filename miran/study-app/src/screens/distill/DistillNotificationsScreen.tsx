// distill 알림 (회의록 §알림) — 즐겨찾기 기업 새 글 · 내 의견 댓글 · 대댓글. 진입 시 읽음 처리.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ChevronLeft,
  CornerDownRight,
  MessageSquare,
  Newspaper,
  Settings,
  UserPlus,
} from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import {
  useAppNotifications,
  useMarkAllNotificationsRead,
  type AppNotificationRow,
  type NotificationKind,
} from "@/data";
import { useNotifPrefs } from "@/lib/notifPrefs";
import { dtype , PRETENDARD} from "@/theme";
import { relativeDate } from "@/components/distill/ArticleCards";
import { Loading, ErrorState, EmptyState } from "@/components";

const KINDS: NotificationKind[] = ["new_article", "comment", "reply", "follow_opinion"];

const KIND_LABEL: Record<NotificationKind, string> = {
  new_article: "즐겨찾기한 기업의 새 글",
  comment: "내 의견에 댓글이 달렸어요",
  reply: "내 댓글에 답글이 달렸어요",
  follow_opinion: "팔로우한 인사이터의 새 독후감",
};

function KindIcon({ kind, color }: { kind: NotificationKind; color: string }) {
  if (kind === "new_article") return <Newspaper size={18} color={color} />;
  if (kind === "reply") return <CornerDownRight size={18} color={color} />;
  if (kind === "follow_opinion") return <UserPlus size={18} color={color} />;
  return <MessageSquare size={18} color={color} />;
}

export function DistillNotificationsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const q = useAppNotifications();
  const markAll = useMarkAllNotificationsRead();
  const { prefs, toggle } = useNotifPrefs();
  const [showSettings, setShowSettings] = useState(false);
  const [tab, setTab] = useState<"all" | "new_article" | "comment">("all");

  const list = (q.data ?? []).filter((n) => prefs[n.kind]);
  const filtered = useMemo(
    () =>
      list.filter((n) =>
        tab === "all" ? true : tab === "new_article" ? n.kind === "new_article" : n.kind === "comment" || n.kind === "reply",
      ),
    [list, tab],
  );
  // 진입 시점에 안 읽었던 알림 id 스냅샷(읽음처리 후에도 이번 세션엔 '새 알림'으로 유지).
  const initialUnread = useRef<Set<string>>(new Set());
  const captured = useRef(false);
  useEffect(() => {
    if (!captured.current && q.data) {
      captured.current = true;
      initialUnread.current = new Set(q.data.filter((n) => !n.read).map((n) => n.id));
      markAll.mutate(); // 진입 시 읽음 처리(회의록 §알림)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q.data]);

  const unread = filtered.filter((n) => initialUnread.current.has(n.id));
  const read = filtered.filter((n) => !initialUnread.current.has(n.id));

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
        <Pressable onPress={() => setShowSettings((s) => !s)} hitSlop={8} style={styles.gearBtn}>
          <Settings size={22} color={showSettings ? c.primary : c.textSecondary} />
        </Pressable>
      </View>

      {/* 알림 설정 */}
      {showSettings ? (
        <View style={[styles.settings, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
          <Text style={[styles.settingsTitle, { color: c.textSecondary }]}>알림 받을 종류</Text>
          {KINDS.map((k) => (
            <View key={k} style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: c.textPrimary }]}>{KIND_LABEL[k]}</Text>
              <Switch
                value={prefs[k]}
                onValueChange={() => toggle(k)}
                trackColor={{ true: c.primary, false: c.hairline }}
                thumbColor="#fff"
              />
            </View>
          ))}
        </View>
      ) : null}

      {/* 종류 탭 */}
      <View style={styles.tabs}>
        {([
          ["all", "전체"],
          ["new_article", "새 글"],
          ["comment", "댓글"],
        ] as const).map(([k, label]) => {
          const on = tab === k;
          return (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              style={[
                styles.tabChip,
                { backgroundColor: on ? c.primary : c.surfaceCard, borderColor: on ? c.primary : c.hairline },
              ]}
            >
              <Text style={[styles.tabText, { color: on ? c.actionOn : c.textSecondary }]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {q.isLoading ? (
        <Loading label="불러오는 중…" />
      ) : q.isError ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState title="새 알림이 없어요" hint="기업을 즐겨찾기하면 새 글 알림을 받아요" />
      ) : (
        <ScrollView
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        >
          {unread.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: c.textPrimary }]}>새 알림</Text>
              {unread.map((item) => (
                <NotiRow key={item.id} item={item} isNew onPress={() => open(item)} />
              ))}
            </>
          ) : null}
          {read.length > 0 ? (
            <>
              <Text style={[styles.sectionLabel, { color: c.textPrimary, marginTop: unread.length > 0 ? 22 : 0 }]}>
                지난 알림
              </Text>
              {read.map((item) => (
                <NotiRow key={item.id} item={item} onPress={() => open(item)} />
              ))}
            </>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function NotiRow({ item, isNew, onPress }: { item: AppNotificationRow; isNew?: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.9 : 1 }]}
    >
      <View style={[styles.iconWrap, { backgroundColor: isNew ? c.primaryTint : c.surfaceSunken }]}>
        <KindIcon kind={item.kind} color={isNew ? c.primary : c.textMuted} />
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
      {isNew ? <View style={[styles.dot, { backgroundColor: c.hot }]} /> : null}
    </Pressable>
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
  gearBtn: { width: 24, alignItems: "flex-end" },

  settings: { marginHorizontal: 16, marginBottom: 8, borderWidth: 1, borderRadius: 14, padding: 14, gap: 4 },
  settingsTitle: { ...dtype.label, fontSize: 12, marginBottom: 4 },
  settingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 4 },
  settingLabel: { ...dtype.body },

  tabs: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingTop: 4, paddingBottom: 10 },
  tabChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 7 },
  tabText: { fontSize: 13, lineHeight: 18, fontWeight: "700", fontFamily: PRETENDARD["700"] },

  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  sectionLabel: { ...dtype.title, fontSize: 15, marginBottom: 8 },
  row: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  label: { ...dtype.meta, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  title: { ...dtype.bodyS, fontWeight: "600", fontFamily: PRETENDARD["600"], marginTop: 3, lineHeight: 20 },
  time: { ...dtype.meta, marginTop: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
