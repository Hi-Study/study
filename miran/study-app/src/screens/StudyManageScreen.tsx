import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useConfirm } from "@/providers/ConfirmProvider";
import { useRootNav } from "@/navigation/types";
import { useMyStudies, useDeleteStudy, type MyStudy } from "@/data/studies";
import { EmptyState, ErrorState, Loading, PillButton } from "@/components";
import { Screen, ScreenHeader, SectionLabel } from "@/components/Chrome";

export function StudyManageScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const mine = useMyStudies();
  const del = useDeleteStudy();
  const confirm = useConfirm();

  const owned: MyStudy[] = (mine.data ?? []).filter((m: MyStudy) => m.role === "owner");

  async function onDelete(m: MyStudy) {
    const ok = await confirm({
      title: "스터디 삭제",
      message: `'${m.study.name}' 스터디를 삭제할까요? 되돌릴 수 없어요.`,
      confirmText: "삭제",
      destructive: true,
    });
    if (ok) del.mutate(m.study.id);
  }

  return (
    <Screen contentStyle={styles.content}>
      <ScreenHeader title="스터디 관리" onBack={() => nav.goBack()} />
      <Text style={[styles.subtitle, { color: c.textMuted }]}>
        내가 만든 스터디를 수정하거나 삭제할 수 있어요.
      </Text>

      <SectionLabel>내가 만든 스터디</SectionLabel>
      {mine.isLoading ? (
        <Loading />
      ) : mine.isError ? (
        <ErrorState message={mine.error?.message} onRetry={() => mine.refetch()} />
      ) : owned.length === 0 ? (
        <EmptyState title="직접 만든 스터디가 없어요." />
      ) : (
        <View style={[styles.card, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
          {owned.map((m: MyStudy, i) => (
            <View
              key={m.study.id}
              style={[styles.row, { borderBottomColor: c.dividerSoft, borderBottomWidth: i === owned.length - 1 ? 0 : 1 }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={[styles.name, { color: c.textPrimary }]}>{m.study.name}</Text>
                <Text style={[styles.meta, { color: c.textMuted }]}>코드 {m.study.invite_code}</Text>
              </View>
              <Pressable
                onPress={() => nav.navigate("StudyEdit", { studyId: m.study.id })}
                style={[styles.pill, { borderColor: c.hairline }]}
              >
                <Text style={{ color: c.textPrimary, fontSize: 13, fontWeight: "600" }}>수정</Text>
              </Pressable>
              <Pressable onPress={() => onDelete(m)} style={[styles.pill, { borderColor: "#c0392b" }]}>
                <Text style={{ color: "#c0392b", fontSize: 13, fontWeight: "600" }}>삭제</Text>
              </Pressable>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 8 }} />
      <PillButton label="+ 새 스터디 만들기" onPress={() => nav.navigate("CreateStudy")} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 10 },
  subtitle: { fontSize: 13.5, marginTop: -4 },
  card: { borderWidth: 1, borderRadius: 12, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", gap: 8, padding: 14 },
  name: { fontSize: 15, fontWeight: "600" },
  meta: { fontSize: 12.5, marginTop: 2 },
  pill: { borderWidth: 1, borderRadius: 90, paddingHorizontal: 14, paddingVertical: 6 },
});
