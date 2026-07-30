import { useState } from "react";
import { Alert, StyleSheet, Text, TextInput, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useJoinByCode } from "@/data/studies";
import { sanitizeInviteCode } from "@/lib/invite";
import { Screen, ScreenHeader } from "@/components/Chrome";
import { PillButton } from "@/components";

export function JoinStudyScreen() {
  const { theme } = useTheme();
  const nav = useRootNav();
  const join = useJoinByCode();

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const clean = sanitizeInviteCode(code);
  const ready = clean.length === 6 && !submitting;

  async function onJoin() {
    if (!ready) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await join.mutateAsync(clean);
      if (res.status === "already_member") {
        Alert.alert("이미 참여 중", "이미 참여한 스터디예요. 해당 스터디로 이동합니다.");
      }
      nav.navigate("Study", { studyId: res.study_id });
    } catch {
      setError("존재하지 않는 코드예요. 다시 확인해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Screen
      header={<ScreenHeader title="초대 코드로 참여" onBack={() => nav.goBack()} />}
      keyboardAvoiding
      contentStyle={styles.content}
    >
      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
        방장에게 받은 6자리 코드를 입력하세요.
      </Text>

      <TextInput
        value={clean}
        onChangeText={(t) => {
          setCode(t);
          setError("");
        }}
        placeholder="ABC123"
        placeholderTextColor={theme.colors.textMuted}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={6}
        style={[
          styles.codeInput,
          {
            backgroundColor: theme.colors.surfaceCard,
            borderColor: error ? "#c0392b" : theme.colors.hairline,
            color: theme.colors.textPrimary,
          },
        ]}
      />

      {error ? (
        <Text style={[styles.error, { color: "#c0392b" }]}>{error}</Text>
      ) : (
        <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
          예시 코드: K7F2QX · UX9M3T · PM4W8R
        </Text>
      )}

      <View style={{ flex: 1 }} />
      <PillButton
        label="참여하기"
        onPress={onJoin}
        disabled={!ready}
        loading={submitting}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, gap: 14, flexGrow: 1 },
  subtitle: { fontSize: 14, marginTop: -4, marginBottom: 8 },
  codeInput: {
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: 18,
    textAlign: "center",
    fontSize: 32,
    fontWeight: "700",
    letterSpacing: 10,
  },
  error: { fontSize: 13, marginHorizontal: 2 },
  hint: { fontSize: 12.5, marginHorizontal: 2 },
});
