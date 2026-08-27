// distill 커뮤니티 자유글 작성 — 제목 + 감상문(인사이트와 동일 항목). 인사이트 탭 > 커뮤니티 FAB.
import React, { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useCreateCommunityPost } from "@/data";
import { cleanInsight, EMPTY_INSIGHT, type Insight } from "@/lib/insight";
import { dtype } from "@/theme";

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  multiline = true,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  required?: boolean;
  multiline?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: c.textSecondary }]}>
        {label}
        {required ? <Text style={{ color: c.primary }}> *</Text> : null}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        multiline={multiline}
        style={[
          styles.input,
          multiline && styles.inputMulti,
          { color: c.textPrimary, borderColor: c.hairline, backgroundColor: c.surfaceCard },
        ]}
      />
    </View>
  );
}

export function CreateCommunityPostScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const create = useCreateCommunityPost();
  const [title, setTitle] = useState("");
  const [insight, setInsight] = useState<Insight>({ ...EMPTY_INSIGHT });
  const set = (patch: Partial<Insight>) => setInsight((p) => ({ ...p, ...patch }));

  const canSubmit = title.trim().length >= 2 && insight.core.trim().length > 0 && !create.isPending;

  const submit = () => {
    if (!canSubmit) return;
    const clean = cleanInsight(insight);
    create.mutate(
      { title: title.trim(), insight: clean ?? insight },
      { onSuccess: () => nav.goBack() },
    );
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.backBtn}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.textPrimary }]}>자유글 쓰기</Text>
        <Pressable onPress={submit} disabled={!canSubmit} hitSlop={8} style={styles.submitBtn}>
          <Text style={[styles.submitText, { color: canSubmit ? c.primary : c.textMuted }]}>등록</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="제목"
            placeholderTextColor={c.textMuted}
            style={[styles.title, { color: c.textPrimary, borderBottomColor: c.hairline }]}
            maxLength={100}
          />
          {/* 인사이트와 동일한 감상문 항목 */}
          <Field
            label="인상 깊은 부분"
            required
            value={insight.core}
            onChangeText={(t) => set({ core: t })}
            placeholder="가장 인상 깊었던 점·생각"
          />
          <Field
            label="접목하고 싶은 방법"
            value={insight.apply}
            onChangeText={(t) => set({ apply: t })}
            placeholder="내 업무·기획에 어떻게 접목할지"
          />
          <Field
            label="질문 · 나누고 싶은 것"
            value={insight.questions[0] ?? ""}
            onChangeText={(t) => set({ questions: t ? [t] : [] })}
            placeholder="함께 나누고 싶은 질문"
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  backBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...dtype.title },
  submitBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  submitText: { ...dtype.cardTitle, fontSize: 15 },

  content: { padding: 16, gap: 16, flexGrow: 1 },
  title: { ...dtype.titleL, borderBottomWidth: 1, paddingVertical: 10 },
  field: { gap: 8 },
  label: { ...dtype.label, fontSize: 13 },
  input: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, ...dtype.body },
  inputMulti: { minHeight: 64, textAlignVertical: "top" },
});
