import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useProfile, useUpdateProfile } from "@/data/profile";
import { Avatar, Loading, PillButton, TextField } from "@/components";
import { Screen, ScreenHeader } from "@/components/Chrome";
import { PRETENDARD } from "@/theme";

export function ProfileEditScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const profile = useProfile();
  const update = useUpdateProfile();

  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [ready, setReady] = useState(false);

  // 프로필 로드되면 1회 초기화.
  useEffect(() => {
    if (profile.data && !ready) {
      setName(profile.data.name === "게스트" ? "" : profile.data.name);
      setRole(profile.data.role_title ?? "");
      setReady(true);
    }
  }, [profile.data, ready]);

  const shown = name.trim() || "게스트";

  function save() {
    update.mutate(
      { name: name.trim() || "게스트", role_title: role.trim() || null },
      { onSuccess: () => nav.goBack() },
    );
  }

  return (
    <Screen
      header={<ScreenHeader title="프로필 설정" onBack={() => nav.goBack()} />}
      keyboardAvoiding
      contentStyle={styles.content}
    >
      {!ready ? (
        <Loading />
      ) : (
        <>
          <View style={styles.preview}>
            <Avatar name={shown} size={84} />
            <Text style={[styles.previewName, { color: c.textPrimary }]}>{shown}</Text>
            {role.trim() ? (
              <Text style={[styles.previewRole, { color: c.textMuted }]}>{role.trim()}</Text>
            ) : null}
          </View>

          <View style={[styles.card, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
            <TextField label="표시 이름" value={name} onChangeText={setName} placeholder="게스트" maxLength={20} />
            <View style={{ height: 14 }} />
            <TextField label="직급 · 역할" value={role} onChangeText={setRole} placeholder="예: PM, 기획자, 디자이너" maxLength={20} />
            <Text style={[styles.hint, { color: c.textMuted }]}>
              이름을 비우면 “게스트”로 표시되고, 아이콘은 이름 첫 글자를 사용해요. 직급은 내가 올린 글·댓글에 함께 표시됩니다.
            </Text>
          </View>

          <PillButton label="저장" onPress={save} loading={update.isPending} />
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  preview: { alignItems: "center", paddingVertical: 8, gap: 4 },
  previewName: { fontSize: 18, fontWeight: "600", fontFamily: PRETENDARD["600"], marginTop: 8 },
  previewRole: { fontSize: 13 },
  card: { borderWidth: 1, borderRadius: 12, padding: 16 },
  hint: { fontSize: 12, marginTop: 10, lineHeight: 18 },
});
