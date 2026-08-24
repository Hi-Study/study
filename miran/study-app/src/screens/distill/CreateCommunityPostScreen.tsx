// distill 커뮤니티 자유글 작성 — 제목 + 내용. 인사이트 탭 > 커뮤니티의 FAB로 진입.
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
import { dtype } from "@/theme";

export function CreateCommunityPostScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const create = useCreateCommunityPost();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const canSubmit = title.trim().length >= 2 && body.trim().length >= 2 && !create.isPending;

  const submit = () => {
    if (!canSubmit) return;
    create.mutate(
      { title: title.trim(), body: body.trim() },
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

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="제목"
            placeholderTextColor={c.textMuted}
            style={[styles.title, { color: c.textPrimary, borderBottomColor: c.hairline }]}
            maxLength={100}
          />
          <TextInput
            value={body}
            onChangeText={setBody}
            placeholder="자유롭게 생각을 나눠보세요."
            placeholderTextColor={c.textMuted}
            style={[styles.body, { color: c.textPrimary }]}
            multiline
            textAlignVertical="top"
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

  content: { padding: 16, gap: 12, flexGrow: 1 },
  title: { ...dtype.titleL, borderBottomWidth: 1, paddingVertical: 10 },
  body: { ...dtype.body, lineHeight: 23, minHeight: 220, paddingTop: 4 },
});
