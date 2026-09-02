import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Bell, Settings } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useMyStudies, type MyStudy } from "@/data/studies";
import { useUnreadNotifications } from "@/data/notifications";
import {
  Avatar,
  EmptyState,
  ErrorState,
  GhostIconButton,
  Loading,
  PillButton,
  RedDot,
  SearchField,
  SectionLabel,
  Tag,
} from "@/components";
import { Screen } from "@/components/Chrome";
import { PRETENDARD } from "@/theme";

export function MyStudiesScreen() {
  const { theme } = useTheme();
  const nav = useRootNav();
  const { data, isLoading, isError, error, refetch, isRefetching } = useMyStudies();
  const [q, setQ] = useState("");

  const filtered = useMemo<MyStudy[]>(() => {
    const list: MyStudy[] = data ?? [];
    const key = q.trim();
    if (!key) return list;
    return list.filter((m: MyStudy) => m.study.name.includes(key));
  }, [data, q]);

  const unread = useUnreadNotifications();
  const hasPending =
    (data ?? []).some((m: MyStudy) => m.unreadCount > 0) || (unread.data ?? 0) > 0;

  return (
    <Screen contentStyle={styles.content} refreshing={isRefetching} onRefresh={() => refetch()}>
      {/* 워크스페이스 헤더 */}
      <View style={styles.wsHeader}>
        <View style={[styles.wsTile, { backgroundColor: theme.colors.primary }]}>
          <Text style={styles.wsTileText}>기</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.wsTitle, { color: theme.colors.textPrimary }]}>
            기획 스터디
          </Text>
          <Text style={[styles.wsSub, { color: theme.colors.textMuted }]}>
            워크스페이스 · {data?.length ?? 0}
          </Text>
        </View>
        <GhostIconButton onPress={() => nav.navigate("Notifications")}>
          <View>
            <Bell size={20} color={theme.colors.textMuted} />
            {hasPending ? (
              <View style={styles.bellDot}>
                <RedDot size={7} />
              </View>
            ) : null}
          </View>
        </GhostIconButton>
        <GhostIconButton onPress={() => nav.navigate("StudyManage")}>
          <Settings size={20} color={theme.colors.textMuted} />
        </GhostIconButton>
      </View>

      <SearchField
        value={q}
        onChangeText={setQ}
        placeholder="스터디 검색 또는 점프하기"
      />

      <SectionLabel>내 스터디</SectionLabel>

      {isLoading ? (
        <Loading label="스터디를 불러오는 중…" />
      ) : isError ? (
        <ErrorState message={error?.message} onRetry={() => refetch()} />
      ) : filtered.length === 0 ? (
        <EmptyState
          title={q ? "검색 결과가 없어요" : "아직 참여한 스터디가 없어요"}
          hint={q ? undefined : "새 스터디를 만들거나 초대 코드로 참여해보세요"}
        />
      ) : (
        <View style={styles.list}>
          {filtered.map((m: MyStudy) => (
            <StudyRow
              key={m.study.id}
              item={m}
              onPress={() => nav.navigate("Study", { studyId: m.study.id })}
            />
          ))}
        </View>
      )}

      {/* 하단 액션 */}
      <View style={styles.cta}>
        <PillButton
          label="+ 새 스터디 만들기"
          onPress={() => nav.navigate("CreateStudy")}
        />
        <PillButton
          label="초대 코드로 참여하기"
          variant="lavender"
          onPress={() => nav.navigate("JoinStudy")}
        />
      </View>
    </Screen>
  );
}

function StudyRow({ item, onPress }: { item: MyStudy; onPress: () => void }) {
  const { theme } = useTheme();
  const s = item.study;
  const unread = item.unreadCount > 0;
  const subtitle = item.activeTopic
    ? `💬 ${item.activeTopic}`
    : `멤버 ${item.memberCount}명`;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && { backgroundColor: theme.colors.surfacePageAlt },
      ]}
    >
      <Avatar name={s.name} size={40} square />
      <View style={{ flex: 1 }}>
        <View style={styles.rowTitleLine}>
          <Text
            numberOfLines={1}
            style={[
              styles.rowTitle,
              { color: theme.colors.textPrimary, fontWeight: unread ? "800" : "600" },
            ]}
          >
            {s.name}
          </Text>
          {item.role === "owner" ? <Tag label="방장" kind="owner" /> : null}
        </View>
        <Text
          numberOfLines={1}
          style={[
            styles.rowSub,
            { color: unread ? theme.colors.textSecondary : theme.colors.textMuted },
          ]}
        >
          {subtitle}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={[styles.rowMembers, { color: theme.colors.textMuted }]}>
          {item.memberCount}명
        </Text>
        {unread ? <RedDot /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 12, gap: 10 },
  wsHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 6,
  },
  wsTile: {
    width: 34,
    height: 34,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
  },
  wsTileText: { color: "#fff", fontWeight: "800", fontFamily: PRETENDARD["800"], fontSize: 17 },
  wsTitle: { fontSize: 19, fontWeight: "800", fontFamily: PRETENDARD["800"], letterSpacing: -0.4 },
  wsSub: { fontSize: 11.5, marginTop: 1 },
  list: { gap: 2 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 9,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  rowTitleLine: { flexDirection: "row", alignItems: "center", gap: 6 },
  rowTitle: { fontSize: 15.5, fontWeight: "600", fontFamily: PRETENDARD["600"], letterSpacing: -0.3, flexShrink: 1 },
  rowSub: { fontSize: 12.5, marginTop: 1 },
  rowRight: { alignItems: "flex-end", gap: 4 },
  rowMembers: { fontSize: 11 },
  bellDot: { position: "absolute", top: -2, right: -2 },
  cta: { gap: 8, marginTop: 12 },
});
