import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Check } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useCreateStudy, getStudy } from "@/data/studies";
import { CADENCE_OPTIONS } from "@/lib/cadence";
import { Screen, ScreenHeader } from "@/components/Chrome";
import { PillButton, TextField } from "@/components";

interface Result {
  code: string;
  name: string;
}

export function CreateStudyScreen() {
  const { theme } = useTheme();
  const nav = useRootNav();
  const create = useCreateStudy();

  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [cadence, setCadence] = useState<string>("주 2회");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);

  const canSubmit = name.trim().length > 0 && !submitting;

  async function onSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const id = await create.mutateAsync({ name: name.trim(), description: desc.trim() || null, cadence });
      const study = await getStudy(id);
      setResult({ code: study.invite_code, name: study.name });
    } catch (e) {
      Alert.alert("스터디 생성 실패", e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCode() {
    if (!result) return;
    await Clipboard.setStringAsync(result.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  // ---- 결과 화면 ----
  if (result) {
    return (
      <Screen contentStyle={styles.resultContent}>
        <View style={[styles.checkCircle, { backgroundColor: theme.colors.accentTint }]}>
          <Check size={30} color={theme.colors.primary} />
        </View>
        <Text style={[styles.resultTitle, { color: theme.colors.textPrimary }]}>
          스터디를 만들었어요
        </Text>
        <Text style={[styles.resultDesc, { color: theme.colors.textSecondary }]}>
          아래 초대 코드를 멤버에게 공유하세요.{"\n"}코드를 입력하면 스터디에 참여할 수 있어요.
        </Text>

        <View style={[styles.codeBox, { borderColor: theme.colors.primary, backgroundColor: theme.colors.accentTint }]}>
          <Text style={[styles.codeLabel, { color: theme.colors.textMuted }]}>
            {result.name} 초대 코드
          </Text>
          <Text style={[styles.code, { color: theme.colors.textPrimary }]}>
            {result.code}
          </Text>
        </View>

        <PillButton
          label={copied ? "복사됨 ✓" : "코드 복사"}
          variant="lavender"
          onPress={copyCode}
        />
        <PillButton label="완료" onPress={() => nav.popToTop()} />
      </Screen>
    );
  }

  // ---- 입력 폼 ----
  return (
    <Screen
      header={<ScreenHeader title="새 스터디 만들기" onBack={() => nav.goBack()} />}
      keyboardAvoiding
      contentStyle={styles.formContent}
    >
      <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
        만들면 초대 코드가 자동으로 생성돼요.
      </Text>

      <TextField
        label="스터디 이름"
        value={name}
        onChangeText={setName}
        placeholder="예: 기획 뜯어보기"
        maxLength={40}
      />
      <TextField
        label="소개"
        value={desc}
        onChangeText={setDesc}
        placeholder="어떤 스터디인지 한 줄로 소개해주세요"
        multiline
        maxLength={200}
      />

      {/* 글 공유 주기 */}
      <View>
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>글 공유 주기</Text>
        <Text style={[styles.hint, { color: theme.colors.textMuted }]}>
          멤버가 이만큼 공유글을 올리는 걸 목표로 해요. 주기가 지나면 미공유 멤버에게 알림이 가요. (설정에서 나중에 변경 가능)
        </Text>
        <View style={styles.chips}>
          {CADENCE_OPTIONS.map((opt) => {
            const on = opt === cadence;
            return (
              <Pressable
                key={opt}
                onPress={() => setCadence(opt)}
                style={[
                  styles.chip,
                  {
                    backgroundColor: theme.colors.surfaceCard,
                    borderColor: on ? theme.colors.primaryFocus : theme.colors.hairline,
                    borderWidth: on ? 2 : 1,
                  },
                ]}
              >
                <Text style={{ color: on ? theme.colors.primary : theme.colors.textPrimary, fontSize: 13, fontWeight: "600" }}>
                  {opt}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={{ flex: 1 }} />
      <PillButton
        label="만들고 코드 생성"
        onPress={onSubmit}
        disabled={!canSubmit}
        loading={submitting}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  formContent: { padding: 20, gap: 16, flexGrow: 1 },
  subtitle: { fontSize: 14, marginTop: -4 },
  label: { fontSize: 13, fontWeight: "600" },
  hint: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 90 },
  resultContent: { padding: 20, paddingTop: 48, gap: 14, alignItems: "center" },
  checkCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  resultTitle: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4, marginTop: 8 },
  resultDesc: { fontSize: 14.5, textAlign: "center", lineHeight: 22 },
  codeBox: {
    width: "100%",
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    padding: 24,
    alignItems: "center",
    marginVertical: 16,
  },
  codeLabel: { fontSize: 12, marginBottom: 8 },
  code: { fontSize: 40, fontWeight: "700", letterSpacing: 6 },
});
