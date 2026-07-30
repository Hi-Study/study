import { Pressable, StyleSheet, Text, View } from "react-native";
import type { RouteProp } from "@react-navigation/native";

import { useTheme } from "@/providers/ThemeProvider";
import { useConfirm } from "@/providers/ConfirmProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { useUid } from "@/auth/AuthProvider";
import {
  useStudy,
  useMembers,
  useMemberActions,
  useRegenerateCode,
  useUpdateStudy,
  type MemberWithUser,
} from "@/data/studies";
import { CADENCE_OPTIONS } from "@/lib/cadence";
import { Avatar, ErrorState, Loading } from "@/components";
import { Screen, ScreenHeader, SectionLabel } from "@/components/Chrome";

type R = RouteProp<RootStackParamList, "Members">;

export function MembersScreen({ route }: { route: R }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const uid = useUid();
  const { studyId } = route.params;

  const study = useStudy(studyId);
  const members = useMembers(studyId);
  const { delegate, kick, leave } = useMemberActions(studyId);
  const regen = useRegenerateCode(studyId);
  const updateStudy = useUpdateStudy(studyId);
  const confirm = useConfirm();

  const isOwner = study.data?.owner_id === uid;
  const cadence = study.data?.share_cadence ?? "주 2회";

  const list: MemberWithUser[] = members.data ?? [];
  const me = list.find((m: MemberWithUser) => m.user.id === uid);
  const others = list.filter((m: MemberWithUser) => m.user.id !== uid);

  async function onDelegate(m: MemberWithUser) {
    const ok = await confirm({
      title: "방장 위임",
      message: `${m.user.name}님에게 방장을 위임할까요? 위임 후 나는 일반 멤버가 됩니다.`,
      confirmText: "위임",
    });
    if (ok) delegate.mutate(m.user.id);
  }
  async function onKick(m: MemberWithUser) {
    const ok = await confirm({
      title: "내보내기",
      message: `${m.user.name}님을 내보낼까요?`,
      confirmText: "내보내기",
      destructive: true,
    });
    if (ok) kick.mutate(m.user.id);
  }
  async function onRegen() {
    const ok = await confirm({
      title: "코드 재발급",
      message: "재발급하면 기존 코드는 사용할 수 없어요. 계속할까요?",
      confirmText: "재발급",
    });
    if (ok) regen.mutate();
  }
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
    <Screen contentStyle={styles.content}>
      <ScreenHeader title="멤버" onBack={() => nav.goBack()} />

      {members.isLoading ? (
        <Loading />
      ) : members.isError ? (
        <ErrorState message={members.error?.message} onRetry={() => members.refetch()} />
      ) : (
        <>
          <Text style={[styles.count, { color: c.textMuted }]}>{list.length}명</Text>

          {/* 멤버 목록 */}
          <View style={[styles.card, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
            {me ? (
              <View style={[styles.memberRow, { borderBottomColor: c.dividerSoft, borderBottomWidth: others.length ? 1 : 0 }]}>
                <Avatar name={me.user.name} size={40} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.mName, { color: c.textPrimary }]}>
                    {me.user.name} <Text style={{ color: c.textMuted, fontWeight: "400", fontSize: 12 }}>· 나</Text>
                  </Text>
                  <Text style={[styles.mRole, { color: c.textMuted }]}>
                    {[isOwner ? "스터디 개설자" : "멤버", me.user.role_title].filter(Boolean).join(" · ")}
                  </Text>
                </View>
                {isOwner ? (
                  <View style={[styles.ownerBadge, { borderColor: c.primary }]}>
                    <Text style={{ color: c.primary, fontSize: 10.5 }}>방장</Text>
                  </View>
                ) : null}
              </View>
            ) : null}

            {others.map((m: MemberWithUser, i) => (
              <View
                key={m.user.id}
                style={[styles.memberRow, { borderBottomColor: c.dividerSoft, borderBottomWidth: i === others.length - 1 ? 0 : 1 }]}
              >
                <Avatar name={m.user.name} size={40} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.mName, { color: c.textPrimary }]}>{m.user.name}</Text>
                  <Text style={[styles.mRole, { color: c.textMuted }]}>{m.user.role_title || "멤버"}</Text>
                </View>
                {isOwner ? (
                  <View style={styles.actions}>
                    <SmallBtn label="위임" primary onPress={() => onDelegate(m)} />
                    <SmallBtn label="내보내기" onPress={() => onKick(m)} />
                  </View>
                ) : null}
              </View>
            ))}
          </View>

          {/* 초대 코드 (방장) */}
          {isOwner ? (
            <>
              <SectionLabel>초대 코드</SectionLabel>
              <View style={[styles.card, { backgroundColor: c.surfaceCard, borderColor: c.hairline, padding: 16 }]}>
                <View style={styles.codeRow}>
                  <Text style={[styles.code, { color: c.textPrimary }]}>{study.data?.invite_code}</Text>
                  <SmallBtn label="재발급" primary onPress={onRegen} />
                </View>
                <Text style={[styles.desc, { color: c.textMuted }]}>
                  이 코드는 <Text style={{ color: c.textPrimary }}>만료되지 않아요</Text>. 재발급하면 새 코드로 갱신됩니다.
                </Text>
              </View>
            </>
          ) : null}

          {/* 공유 주기 */}
          <SectionLabel>글 공유 주기</SectionLabel>
          <View style={[styles.card, { backgroundColor: c.surfaceCard, borderColor: c.hairline, padding: 14 }]}>
            {isOwner ? (
              <>
                <Text style={[styles.desc, { color: c.textMuted, marginBottom: 10 }]}>
                  멤버들이 얼마나 자주 글을 공유할지 정해요. 주기가 지나면 미공유 멤버에게 알림이 갑니다.
                </Text>
                <View style={styles.chips}>
                  {CADENCE_OPTIONS.map((opt) => {
                    const on = opt === cadence;
                    return (
                      <Pressable
                        key={opt}
                        onPress={() => updateStudy.mutate({ share_cadence: opt })}
                        style={[styles.chip, { backgroundColor: c.surfaceCard, borderColor: on ? c.primaryFocus : c.hairline, borderWidth: on ? 2 : 1 }]}
                      >
                        <Text style={{ color: on ? c.primary : c.textPrimary, fontSize: 13, fontWeight: "600" }}>{opt}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : (
              <Text style={{ color: c.textPrimary, fontSize: 14 }}>
                이 스터디는 <Text style={{ fontWeight: "700" }}>{cadence}</Text> 공유가 목표예요.
              </Text>
            )}
          </View>

          <Pressable onPress={onLeave} style={[styles.leaveBtn, { borderColor: "#c0392b" }]}>
            <Text style={styles.leaveText}>{isOwner ? "스터디 삭제하고 나가기" : "스터디 나가기"}</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

function SmallBtn({ label, primary, onPress }: { label: string; primary?: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={[styles.smallBtn, { borderColor: primary ? c.primary : c.hairline }]}
      hitSlop={4}
    >
      <Text style={{ color: primary ? c.primary : c.textMuted, fontSize: 12, fontWeight: "600" }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  count: { fontSize: 13, textAlign: "right" },
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  memberRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14 },
  mName: { fontSize: 15, fontWeight: "600" },
  mRole: { fontSize: 12.5, marginTop: 1 },
  ownerBadge: { borderWidth: 1, borderRadius: 90, paddingHorizontal: 8, paddingVertical: 1 },
  actions: { flexDirection: "row", gap: 6 },
  smallBtn: { borderWidth: 1, borderRadius: 90, paddingHorizontal: 11, paddingVertical: 5 },
  codeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  code: { fontSize: 26, fontWeight: "700", letterSpacing: 4 },
  desc: { fontSize: 12.5, lineHeight: 18, marginTop: 10 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 90 },
  leaveBtn: { marginTop: 14, paddingVertical: 14, borderWidth: 1, borderRadius: 90, alignItems: "center" },
  leaveText: { color: "#c0392b", fontSize: 16, fontWeight: "600" },
});
