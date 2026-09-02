import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  Clock,
  MessageCircle,
  MessageSquare,
  Reply,
  UserPlus,
  type LucideIcon,
} from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useConfirm } from "@/providers/ConfirmProvider";
import { useRootNav } from "@/navigation/types";
import { useNotifications, useMarkRead, useMarkAllRead } from "@/data/notifications";
import { useMyStudies, type MyStudy } from "@/data/studies";
import { Loading, ErrorState, RedDot, TextButton } from "@/components";
import { Screen, ScreenHeader } from "@/components/Chrome";
import { timeAgo } from "@/lib/date";
import type { NotificationRow } from "@/types/tables";
import type { NotificationType } from "@/types/database";
import { PRETENDARD } from "@/theme";

// 타입별 아이콘 + 제목(한 줄 메시지 위에 얹는 헤더)
const META: Record<NotificationType, { icon: LucideIcon; title: string }> = {
  comment: { icon: MessageSquare, title: "새 댓글" },
  reply: { icon: Reply, title: "답글" },
  discussion_pending: { icon: MessageCircle, title: "토론 참여 알림" },
  cadence: { icon: Clock, title: "공유 주기 알림" },
  member_joined: { icon: UserPlus, title: "새 멤버" },
};

export function NotificationsScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const confirm = useConfirm();
  const list = useNotifications();
  const myStudies = useMyStudies();
  const markRead = useMarkRead();
  const markAll = useMarkAllRead();
  const now = useMemo(() => new Date(), []);

  // 읽은 알림은 목록에서 사라진다(안읽음만 표시).
  const rows: NotificationRow[] = (list.data ?? []).filter((n: NotificationRow) => !n.is_read);
  const myIds = useMemo(
    () => new Set((myStudies.data ?? []).map((m: MyStudy) => m.study.id)),
    [myStudies.data],
  );

  async function onTap(n: NotificationRow) {
    // 삭제되었거나 내가 나간 스터디의 알림 → 진입 차단 + 정리
    if (n.study_id && myStudies.data && !myIds.has(n.study_id)) {
      const ok = await confirm({
        title: "이용할 수 없는 스터디",
        message: "삭제되었거나 나간 스터디의 알림이에요. 이 알림을 지울까요?",
        confirmText: "지우기",
        destructive: true,
      });
      if (ok) markRead.mutate(n.id);
      return;
    }
    markRead.mutate(n.id); // 읽음 → 목록에서 사라짐
    if (n.study_id) nav.navigate("Study", { studyId: n.study_id });
  }

  return (
    <Screen
      contentStyle={styles.content}
      refreshing={list.isRefetching}
      onRefresh={() => list.refetch()}
    >
      <ScreenHeader
        title="알림"
        onBack={() => nav.goBack()}
        right={rows.length > 0 ? <TextButton label="모두 읽음" onPress={() => markAll.mutate()} /> : undefined}
      />

      {list.isLoading ? (
        <Loading />
      ) : list.isError ? (
        <ErrorState message={list.error?.message} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={{ color: c.textMuted, fontSize: 14 }}>새로운 알림이 없어요.</Text>
        </View>
      ) : (
        <View>
          {rows.map((n: NotificationRow) => {
            const meta = META[n.type] ?? { icon: MessageCircle, title: "알림" };
            const Icon = meta.icon;
            return (
              <Pressable key={n.id} onPress={() => onTap(n)} style={styles.row}>
                <View style={[styles.icon, { backgroundColor: c.tintLavender }]}>
                  <Icon size={17} color={c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <View style={styles.topLine}>
                    <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={1}>
                      {meta.title}
                    </Text>
                    <Text style={[styles.time, { color: c.textMuted }]}>
                      {timeAgo(n.created_at, now)}
                    </Text>
                    <RedDot size={7} />
                  </View>
                  <Text style={[styles.body, { color: c.textSecondary }]}>{n.text}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 2 },
  empty: { paddingVertical: 48, alignItems: "center" },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start", paddingVertical: 14 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  topLine: { flexDirection: "row", alignItems: "center", gap: 7 },
  title: { flex: 1, fontSize: 14.5, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  time: { fontSize: 12 },
  body: { fontSize: 14, lineHeight: 20, marginTop: 3 },
});
