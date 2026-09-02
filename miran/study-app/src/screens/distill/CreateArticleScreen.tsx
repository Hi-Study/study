// distill 글 등록(URL) — 회의록 §글 등록. URL 붙여넣기 → 자동 추출(중복 확인) → 독후감 쓰기.
import React, { useState } from "react";
import {
  ActivityIndicator,
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
import { Check, ChevronLeft, ExternalLink, Link2, PenLine } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useRegisterArticle, type RegisterResult } from "@/data";
import { dtype , PRETENDARD} from "@/theme";

export function CreateArticleScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<RegisterResult | null>(null);
  const register = useRegisterArticle();

  const valid = /^https?:\/\/\S+/i.test(url.trim());

  const submit = () => {
    if (!valid || register.isPending) return;
    register.mutate(url.trim(), { onSuccess: (r) => setResult(r) });
  };

  const onChange = (t: string) => {
    setUrl(t);
    if (result) setResult(null);
    if (register.isError) register.reset();
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.backBtn}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.textPrimary }]}>글 등록</Text>
        <View style={{ width: 24 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[styles.label, { color: c.textSecondary }]}>글 주소(URL)</Text>
          <View style={[styles.inputRow, { borderColor: c.hairline, backgroundColor: c.surfaceCard }]}>
            <Link2 size={18} color={c.textMuted} />
            <TextInput
              value={url}
              onChangeText={onChange}
              placeholder="https://…"
              placeholderTextColor={c.textMuted}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              style={[styles.input, { color: c.textPrimary }]}
              onSubmitEditing={submit}
              returnKeyType="done"
            />
          </View>
          <Text style={[styles.hint, { color: c.textMuted }]}>
            테크·기획 블로그 글 주소를 붙여넣으면 제목·본문을 자동으로 가져와요.
          </Text>

          <Pressable
            onPress={submit}
            disabled={!valid || register.isPending}
            style={[
              styles.cta,
              { backgroundColor: valid ? c.primary : c.surfaceSunken, opacity: register.isPending ? 0.7 : 1 },
            ]}
          >
            {register.isPending ? (
              <ActivityIndicator color={c.actionOn} />
            ) : (
              <Text style={[styles.ctaText, { color: valid ? c.actionOn : c.textMuted }]}>확인</Text>
            )}
          </Pressable>

          {register.isError ? (
            <Text style={[styles.error, { color: c.danger }]}>
              가져오지 못했어요. 주소를 확인하고 다시 시도해주세요.
            </Text>
          ) : null}

          {result ? (
            <View style={[styles.result, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
              <View style={styles.resultHead}>
                <Check size={16} color={c.primary} />
                <Text style={[styles.resultBadge, { color: c.primary }]}>
                  {result.existed ? "이미 등록된 글이에요" : "가져왔어요"}
                </Text>
              </View>
              <Text style={[styles.resultTitle, { color: c.textPrimary }]} numberOfLines={3}>
                {result.title}
              </Text>

              {result.existed ? null : (
                <Text style={[styles.resultHint, { color: c.textMuted }]}>
                  독후감을 남기면 토론 탭에 공유돼요.
                </Text>
              )}

              <View style={styles.resultActions}>
                {result.existed ? null : (
                  <Pressable
                    onPress={() => nav.navigate("CreateOpinion", { articleId: result.articleId })}
                    style={[styles.primaryBtn, { backgroundColor: c.primary }]}
                  >
                    <PenLine size={16} color={c.actionOn} />
                    <Text style={[styles.primaryBtnText, { color: c.actionOn }]}>독후감 쓰기</Text>
                  </Pressable>
                )}
                <Pressable
                  onPress={() => nav.navigate("ArticleDetail", { articleId: result.articleId })}
                  style={[styles.secondaryBtn, { borderColor: c.hairline }]}
                >
                  <ExternalLink size={15} color={c.textSecondary} />
                  <Text style={[styles.secondaryBtnText, { color: c.textSecondary }]}>글 보기</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
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
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  backBtn: { width: 24, alignItems: "flex-start" },
  headerTitle: { ...dtype.title },

  body: { padding: 16, gap: 10 },
  label: { ...dtype.label, marginBottom: 2 },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  input: { flex: 1, ...dtype.body, padding: 0 },
  hint: { ...dtype.bodyS, lineHeight: 18 },

  cta: { height: 50, borderRadius: 12, alignItems: "center", justifyContent: "center", marginTop: 6 },
  ctaText: { ...dtype.cardTitle },
  error: { ...dtype.bodyS, marginTop: 4 },

  result: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8, marginTop: 8 },
  resultHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  resultBadge: { ...dtype.label, fontWeight: "800", fontFamily: PRETENDARD["800"] },
  resultTitle: { ...dtype.cardTitle, fontSize: 17, lineHeight: 24 },
  resultHint: { ...dtype.bodyS },
  resultActions: { flexDirection: "row", gap: 10, marginTop: 6 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    borderRadius: 12,
  },
  primaryBtnText: { ...dtype.cardTitle },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 46,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderRadius: 12,
  },
  secondaryBtnText: { ...dtype.cardTitle, fontSize: 14 },
});
