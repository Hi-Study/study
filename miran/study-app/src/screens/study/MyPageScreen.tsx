import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useConfirm } from "@/providers/ConfirmProvider";
import { useRootNav } from "@/navigation/types";
import { useStudyId } from "@/navigation/StudyContext";
import { useUid } from "@/auth/AuthProvider";
import { useProfile } from "@/data/profile";
import { useStudy, useMembers, useMemberActions, useMyStudies } from "@/data/studies";
import { useDashboard, usePendingDiscussions } from "@/data/dashboard";
import { Avatar, SectionLabel } from "@/components";
import { Screen } from "@/components/Chrome";
import { mondayOf, toISODate } from "@/lib/date";

export function MyPageScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const studyId = useStudyId();
  const uid = useUid();

  const profile = useProfile();
  const study = useStudy(studyId);
  const members = useMembers(studyId);
  const weekStart = useMemo(() => toISODate(mondayOf(new Date())), []);
  const dash = useDashboard(weekStart);
  const myStudies = useMyStudies();
  const pending = usePendingDiscussions();
  const { leave } = useMemberActions(studyId);
  const confirm = useConfirm();

  const isOwner = study.data?.owner_id === uid;
  const name = profile.data?.name?.trim() || "게스트";
  const role = profile.data?.role_title;
  const memberCount = members.data?.length ?? 0;

  async function onLeave() {
    const msg = isOwner
      ? `방장인 '${study.data?.name ?? "이 스터디"}'에서 나가면 스터디가 삭제됩니다. 계속할까요?`
      : `'${study.data?.name ?? "이 스터디"}'에서 나갈까요?`;
    const ok = await confirm({
      title: "스터디 나가기",
      message: msg,
      confirmText: isOwner ? "삭제하고 나가기" : "나가기",
      destructive: true,
    });
    if (ok) leave.mutate(undefined, { onSuccess: () => nav.popToTop() });
  }

  return (
    <Screen edges={["left", "right"]} contentStyle={styles.content}>
      {/* 프로필 요약 */}
      <View style={styles.profile}>
        <Avatar name={name} size={60} />
        <View>
          <Text style={[styles.name, { color: c.textPrimary }]}>{name}</Text>
          <Text style={[styles.role, { color: c.textMuted }]}>
            {role || (profile.data?.name ? "내 프로필" : "기본 프로필 (미설정)")}
          </Text>
        </View>
      </View>

      {/* 내 활동 — 카드 누르면 해당 활동 목록 페이지로 이동 */}
      <SectionLabel>내 활동</SectionLabel>
      <View style={styles.statGrid}>
        <Stat label="참여 스터디" value={myStudies.data?.length ?? dash.data?.studyCount ?? 0} onPress={() => nav.navigate("ActivityList", { kind: "study" })} />
        <Stat label="내 공유 글" value={dash.data?.shareCount ?? 0} onPress={() => nav.navigate("ActivityList", { kind: "share" })} />
        <Stat label="남긴 의견" value={dash.data?.commentCount ?? 0} onPress={() => nav.navigate("ActivityList", { kind: "comment" })} />
        <Stat label="미참여 토론" value={pending.data?.length ?? dash.data?.pendingCount ?? 0} accent={(pending.data?.length ?? 0) > 0} onPress={() => nav.navigate("ActivityList", { kind: "pending" })} />
      </View>

      {/* 설정 */}
      <SectionLabel>설정</SectionLabel>
      <View style={[styles.menu, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
        <MenuRow title="멤버" desc={`함께하는 멤버 ${memberCount}명`} onPress={() => nav.navigate("Members", { studyId })} />
        <MenuRow title="프로필 설정" desc="표시 이름과 직급" onPress={() => nav.navigate("ProfileEdit")} />
        <MenuRow title="화면 설정" desc="밤/낮 모드" onPress={() => nav.navigate("DisplaySettings")} last />
      </View>

      <Pressable onPress={onLeave} style={styles.leaveBtn}>
        <Text style={styles.leaveText}>{isOwner ? "스터디 삭제하고 나가기" : "스터디 나가기"}</Text>
      </Pressable>
    </Screen>
  );
}

function Stat({
  label,
  value,
  accent,
  onPress,
}: {
  label: string;
  value: number;
  accent?: boolean;
  onPress?: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable onPress={onPress} style={[styles.stat, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
      <View style={styles.statTop}>
        <Text style={[styles.statValue, { color: accent ? "#c0392b" : c.textPrimary }]}>{value}</Text>
        <ChevronRight size={16} color={c.textMuted} />
      </View>
      <Text style={[styles.statLabel, { color: c.textMuted }]}>{label}</Text>
    </Pressable>
  );
}

function MenuRow({ title, desc, onPress, last }: { title: string; desc: string; onPress: () => void; last?: boolean }) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.menuRow, !last && { borderBottomWidth: 1, borderBottomColor: theme.colors.dividerSoft }]}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.menuTitle, { color: theme.colors.textPrimary }]}>{title}</Text>
        <Text style={[styles.menuDesc, { color: theme.colors.textMuted }]}>{desc}</Text>
      </View>
      <ChevronRight size={18} color={theme.colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  profile: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 8 },
  name: { fontSize: 20, fontWeight: "600" },
  role: { fontSize: 13, marginTop: 2 },
  statGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  stat: { width: "47.8%", flexGrow: 1, borderWidth: 1, borderRadius: 12, padding: 16 },
  statTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statValue: { fontSize: 28, fontWeight: "600", letterSpacing: -0.6 },
  statLabel: { fontSize: 12.5, marginTop: 2 },
  menu: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  menuRow: { flexDirection: "row", alignItems: "center", padding: 15 },
  menuTitle: { fontSize: 15, fontWeight: "600" },
  menuDesc: { fontSize: 12.5, marginTop: 2 },
  leaveBtn: { marginTop: 10, paddingVertical: 14, alignItems: "center" },
  leaveText: { color: "#c0392b", fontSize: 15, fontWeight: "600" },
});
