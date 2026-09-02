import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  ChevronRight,
  FileText,
  MessageCircle,
  MessageSquare,
  Users,
  type LucideIcon,
} from "lucide-react-native";
import type { RouteProp } from "@react-navigation/native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { useMyStudies, type MyStudy } from "@/data/studies";
import {
  useMyActivity,
  usePendingDiscussions,
  type ActivityItem,
  type PendingDiscussion,
} from "@/data/dashboard";
import { EmptyState, ErrorState, Loading } from "@/components";
import { Screen, ScreenHeader } from "@/components/Chrome";
import { timeAgo } from "@/lib/date";
import { PRETENDARD } from "@/theme";

type R = RouteProp<RootStackParamList, "ActivityList">;

const TITLE: Record<R["params"]["kind"], string> = {
  study: "참여 스터디",
  share: "내 공유 글",
  comment: "남긴 의견",
  pending: "미참여 토론",
};

const ICON: Record<R["params"]["kind"], LucideIcon> = {
  study: Users,
  share: FileText,
  comment: MessageSquare,
  pending: MessageCircle,
};

interface Row {
  key: string;
  text: string;
  time?: string;
  accent?: boolean;
  onPress: () => void;
}

export function ActivityListScreen({ route }: { route: R }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const { kind } = route.params;
  const now = useMemo(() => new Date(), []);

  const myStudies = useMyStudies();
  const activity = useMyActivity();
  const pending = usePendingDiscussions();

  const q =
    kind === "study" ? myStudies : kind === "pending" ? pending : activity;

  const rows: Row[] = useMemo(() => {
    if (kind === "study") {
      return (myStudies.data ?? []).map((m: MyStudy) => ({
        key: m.study.id,
        text: m.study.name,
        onPress: () => nav.navigate("Study", { studyId: m.study.id }),
      }));
    }
    if (kind === "pending") {
      return (pending.data ?? []).map((d: PendingDiscussion) => ({
        key: d.id,
        text: d.title,
        accent: true,
        onPress: () => nav.navigate("DiscussionDetail", { studyId: d.studyId, discussionId: d.id }),
      }));
    }
    return (activity.data ?? [])
      .filter((a: ActivityItem) => a.kind === kind)
      .map((a: ActivityItem) => ({
        key: a.id,
        text: a.text,
        time: timeAgo(a.created_at, now),
        onPress: () =>
          a.targetType === "share"
            ? nav.navigate("ShareDetail", { studyId: a.studyId, shareId: a.targetId })
            : nav.navigate("DiscussionDetail", { studyId: a.studyId, discussionId: a.targetId }),
      }));
  }, [kind, myStudies.data, activity.data, pending.data, now, nav]);

  return (
    <Screen
      header={<ScreenHeader title={TITLE[kind]} onBack={() => nav.goBack()} />}
      contentStyle={styles.content}
      refreshing={q.isRefetching}
      onRefresh={() => q.refetch()}
    >
      {q.isLoading ? (
        <Loading />
      ) : q.isError ? (
        <ErrorState message={(q.error as Error)?.message} onRetry={() => q.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="아직 없어요" />
      ) : (
        <View>
          {rows.map((r) => {
            const Icon = ICON[kind];
            return (
              <Pressable key={r.key} onPress={r.onPress} style={styles.row}>
                <View
                  style={[
                    styles.icon,
                    { backgroundColor: r.accent ? "#fbecea" : c.tintLavender },
                  ]}
                >
                  <Icon size={17} color={r.accent ? "#c0392b" : c.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.text, { color: c.textPrimary }]} numberOfLines={2}>
                    {r.text}
                  </Text>
                  {r.time ? <Text style={[styles.time, { color: c.textMuted }]}>{r.time}</Text> : null}
                </View>
                <ChevronRight size={17} color={c.textMuted} />
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
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12 },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  text: { fontSize: 14.5, fontWeight: "600", fontFamily: PRETENDARD["600"] },
  time: { fontSize: 12, marginTop: 3 },
});
