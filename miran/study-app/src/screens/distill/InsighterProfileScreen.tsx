// distill 인사이터 프로필 — 그 사람 정보 + 팔로우 + 남긴 의견(독후감) 모아보기.
import React from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft, UserCheck, UserPlus } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useUid } from "@/auth/AuthProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import {
  useUserProfile,
  useFollowCounts,
  useIsFollowing,
  useToggleFollow,
  useOpinionsByAuthor,
} from "@/data";
import { dtype } from "@/theme";
import { Avatar } from "@/components/Avatar";
import { OpinionCard } from "@/components/distill/OpinionCard";
import { Loading, ErrorState, EmptyState } from "@/components";

type Props = NativeStackScreenProps<RootStackParamList, "InsighterProfile">;

export function InsighterProfileScreen({ route }: Props) {
  const { userId } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const uid = useUid();
  const isMe = uid === userId;

  const profileQ = useUserProfile(userId);
  const counts = useFollowCounts(userId);
  const following = useIsFollowing(userId);
  const toggleFollow = useToggleFollow(userId);
  const opinionsQ = useOpinionsByAuthor(userId);

  const profile = profileQ.data;
  const opinions = opinionsQ.data ?? [];
  const isFollowing = following.data ?? false;

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.backBtn}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.textPrimary }]}>인사이터</Text>
        <View style={{ width: 24 }} />
      </View>

      {profileQ.isLoading ? (
        <Loading label="불러오는 중…" />
      ) : profileQ.isError || !profile ? (
        <ErrorState onRetry={() => profileQ.refetch()} />
      ) : (
        <FlatList
          data={opinions}
          keyExtractor={(o) => o.id}
          renderItem={({ item }) => (
            <OpinionCard opinion={item} onPress={() => nav.navigate("OpinionDetail", { opinionId: item.id })} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View>
              {/* 프로필 */}
              <View style={styles.profile}>
                <Avatar name={profile.name} size={64} />
                <Text style={[styles.name, { color: c.textPrimary }]}>{profile.name}</Text>
                {profile.role_title ? (
                  <Text style={[styles.role, { color: c.textMuted }]}>{profile.role_title}</Text>
                ) : null}

                <View style={styles.counts}>
                  <View style={styles.countItem}>
                    <Text style={[styles.countNum, { color: c.textPrimary }]}>
                      {counts.data?.followers ?? 0}
                    </Text>
                    <Text style={[styles.countLabel, { color: c.textMuted }]}>팔로워</Text>
                  </View>
                  <View style={[styles.countDivider, { backgroundColor: c.hairline }]} />
                  <View style={styles.countItem}>
                    <Text style={[styles.countNum, { color: c.textPrimary }]}>
                      {counts.data?.following ?? 0}
                    </Text>
                    <Text style={[styles.countLabel, { color: c.textMuted }]}>팔로잉</Text>
                  </View>
                  <View style={[styles.countDivider, { backgroundColor: c.hairline }]} />
                  <View style={styles.countItem}>
                    <Text style={[styles.countNum, { color: c.textPrimary }]}>{opinions.length}</Text>
                    <Text style={[styles.countLabel, { color: c.textMuted }]}>독후감</Text>
                  </View>
                </View>

                {!isMe ? (
                  <Pressable
                    onPress={() => toggleFollow.mutate(!isFollowing)}
                    disabled={toggleFollow.isPending}
                    style={[
                      styles.followBtn,
                      isFollowing
                        ? { backgroundColor: c.surfaceSunken, borderColor: c.hairline }
                        : { backgroundColor: c.primary, borderColor: c.primary },
                    ]}
                  >
                    {isFollowing ? (
                      <UserCheck size={16} color={c.textSecondary} />
                    ) : (
                      <UserPlus size={16} color={c.actionOn} />
                    )}
                    <Text style={[styles.followText, { color: isFollowing ? c.textSecondary : c.actionOn }]}>
                      {isFollowing ? "팔로잉" : "팔로우"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>

              <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>남긴 독후감</Text>
              {opinionsQ.isLoading ? <Loading label="불러오는 중…" /> : null}
              {!opinionsQ.isLoading && opinions.length === 0 ? (
                <EmptyState title="아직 독후감이 없어요" hint="이 인사이터가 독후감을 남기면 여기 모여요" />
              ) : null}
            </View>
          }
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

  listContent: { paddingHorizontal: 16, paddingBottom: 32 },
  profile: { alignItems: "center", gap: 6, paddingTop: 8, paddingBottom: 20 },
  name: { ...dtype.titleL, marginTop: 6 },
  role: { ...dtype.bodyS },
  counts: { flexDirection: "row", alignItems: "center", gap: 18, marginTop: 12 },
  countItem: { alignItems: "center", gap: 2 },
  countNum: { ...dtype.title },
  countLabel: { ...dtype.meta },
  countDivider: { width: 1, height: 24 },
  followBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: 16,
  },
  followText: { ...dtype.cardTitle, fontSize: 14 },
  sectionTitle: { ...dtype.title, marginBottom: 12 },
});
