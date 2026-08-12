// distill 의견 남기기 — 구조화 "핵심 인사이트"(core 필수 + 인용·해석·적용·사례·질문).
import React, { useEffect, useRef, useState } from "react";
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
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft, Plus, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { useCreateOpinion, useDraft, useUpsertDraft, useDeleteDraft } from "@/data";
import { cleanInsight, EMPTY_INSIGHT, type Insight } from "@/lib/insight";
import { dtype } from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "CreateOpinion">;

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

export function CreateOpinionScreen({ route }: Props) {
  const { articleId } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const create = useCreateOpinion(articleId);
  const draftQ = useDraft(articleId);
  const upsertDraft = useUpsertDraft(articleId);
  const deleteDraft = useDeleteDraft(articleId);

  const [insight, setInsight] = useState<Insight>({ ...EMPTY_INSIGHT });
  const set = (patch: Partial<Insight>) => setInsight((p) => ({ ...p, ...patch }));

  // 임시저장 불러오기 — 최초 로드 시 1회만 채운다.
  const loadedRef = useRef(false);
  useEffect(() => {
    if (!loadedRef.current && draftQ.data) {
      loadedRef.current = true;
      setInsight({ ...EMPTY_INSIGHT, ...draftQ.data });
    }
  }, [draftQ.data]);

  const hasContent = [
    insight.core,
    insight.quote,
    insight.interpretation,
    insight.apply,
    insight.similar,
    ...insight.questions,
  ].some((s) => s.trim().length > 0);

  const canSave = insight.core.trim().length > 0 && !create.isPending;

  const saveDraft = () => {
    if (!hasContent || upsertDraft.isPending) return;
    upsertDraft.mutate(insight, { onSuccess: () => nav.goBack() });
  };

  const save = () => {
    const clean = cleanInsight(insight);
    if (!clean) return;
    create.mutate(clean, {
      onSuccess: () => {
        deleteDraft.mutate(); // 발행되면 임시저장 제거
        nav.goBack();
      },
    });
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      {/* 헤더 */}
      <View style={[styles.header, { borderBottomColor: c.hairline }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.hBtn}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <Text style={[styles.hTitle, { color: c.textPrimary }]}>의견 남기기</Text>
        <Pressable
          onPress={saveDraft}
          disabled={!hasContent || upsertDraft.isPending}
          hitSlop={8}
          style={styles.hBtnWide}
        >
          <Text style={[styles.draft, { color: hasContent ? c.textSecondary : c.textMuted }]}>
            임시저장
          </Text>
        </Pressable>
        <Pressable onPress={save} disabled={!canSave} hitSlop={8} style={styles.hBtn}>
          <Text style={[styles.save, { color: canSave ? c.primary : c.textMuted }]}>저장</Text>
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Field
            label="핵심 인사이트"
            required
            value={insight.core}
            onChangeText={(t) => set({ core: t })}
            placeholder="이 글에서 가장 중요하게 느낀 한 가지"
          />
          <Field
            label="인상적인 문장"
            value={insight.quote}
            onChangeText={(t) => set({ quote: t })}
            placeholder="기억하고 싶은 문장(인용)"
          />
          <Field
            label="내 해석"
            value={insight.interpretation}
            onChangeText={(t) => set({ interpretation: t })}
            placeholder="이 인사이트를 어떻게 이해했는지"
          />
          <Field
            label="바로 적용할 것"
            value={insight.apply}
            onChangeText={(t) => set({ apply: t })}
            placeholder="내 업무/기획에 적용할 점"
          />
          <Field
            label="비슷한 사례"
            value={insight.similar}
            onChangeText={(t) => set({ similar: t })}
            placeholder="떠오르는 유사 사례"
          />

          {/* 질문 리스트 */}
          <View style={styles.field}>
            <Text style={[styles.label, { color: c.textSecondary }]}>나눌 질문</Text>
            {insight.questions.map((qv, i) => (
              <View key={i} style={styles.qRow}>
                <TextInput
                  value={qv}
                  onChangeText={(t) =>
                    set({ questions: insight.questions.map((x, j) => (j === i ? t : x)) })
                  }
                  placeholder={`질문 ${i + 1}`}
                  placeholderTextColor={c.textMuted}
                  style={[
                    styles.input,
                    { flex: 1, color: c.textPrimary, borderColor: c.hairline, backgroundColor: c.surfaceCard },
                  ]}
                />
                <Pressable
                  onPress={() => set({ questions: insight.questions.filter((_, j) => j !== i) })}
                  hitSlop={8}
                  style={styles.qDel}
                >
                  <X size={18} color={c.textMuted} />
                </Pressable>
              </View>
            ))}
            <Pressable
              onPress={() => set({ questions: [...insight.questions, ""] })}
              style={[styles.addQ, { borderColor: c.hairline }]}
            >
              <Plus size={16} color={c.primary} />
              <Text style={[styles.addQText, { color: c.primary }]}>질문 추가</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
  },
  hBtn: { minWidth: 44, height: 40, alignItems: "center", justifyContent: "center" },
  hBtnWide: { paddingHorizontal: 8, height: 40, alignItems: "center", justifyContent: "center" },
  hTitle: { ...dtype.title, flex: 1, textAlign: "center" },
  save: { ...dtype.cardTitle },
  draft: { ...dtype.bodyS, fontWeight: "700" },

  content: { padding: 16, gap: 18, paddingBottom: 40 },
  field: { gap: 8 },
  label: { ...dtype.label, fontSize: 13 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...dtype.body,
  },
  inputMulti: { minHeight: 64, textAlignVertical: "top" },

  qRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  qDel: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  addQ: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginTop: 2,
  },
  addQText: { ...dtype.bodyS, fontWeight: "700" },
});
