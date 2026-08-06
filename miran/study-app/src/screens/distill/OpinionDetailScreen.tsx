// distill 의견 상세 (DESIGN_GUIDE §7.5) — 의견 전문 · 출처 글 · 대댓글 토론.
import React, { useState } from "react";
import {
  Image,
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
import { ChevronLeft, Send } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { useOpinion, useOpinionComments, useCreateOpinionComment } from "@/data";
import { dtype } from "@/theme";
import { Avatar } from "@/components/Avatar";
import { ServiceLogo, TopicChip, relativeDate } from "@/components/distill/ArticleCards";
import { Loading, ErrorState } from "@/components";

type Props = NativeStackScreenProps<RootStackParamList, "OpinionDetail">;

function InsightField({ label, value }: { label: string; value: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  if (!value) return null;
  return (
    <View style={styles.iField}>
      <Text style={[styles.iLabel, { color: c.textMuted }]}>{label}</Text>
      <Text style={[styles.iValue, { color: c.textPrimary }]}>{value}</Text>
    </View>
  );
}

export function OpinionDetailScreen({ route }: Props) {
  const { opinionId } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const q = useOpinion(opinionId);
  const commentsQ = useOpinionComments(opinionId);
  const createComment = useCreateOpinionComment(opinionId);
  const [text, setText] = useState("");

  if (q.isLoading) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]}>
        <Loading label="불러오는 중…" />
      </SafeAreaView>
    );
  }
  if (q.isError || !q.data) {
    return (
      <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]}>
        <ErrorState onRetry={() => q.refetch()} />
      </SafeAreaView>
    );
  }

  const o = q.data;
  const a = o.article;
  const comments = commentsQ.data ?? [];

  const send = () => {
    const t = text.trim();
    if (!t) return;
    createComment.mutate({ text: t }, { onSuccess: () => setText("") });
  };

  return (
    <SafeAreaView
      style={[styles.screen, { backgroundColor: c.surfacePage }]}
      edges={["top", "left", "right"]}
    >
      <View style={[styles.header, { borderBottomColor: c.hairline }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.hBtn}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <Text style={[styles.hTitle, { color: c.textPrimary }]}>의견</Text>
        <View style={styles.hBtn} />
      </View>

      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {/* 작성자 */}
          <View style={styles.author}>
            <Avatar name={o.author?.name ?? "게스트"} size={40} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.who, { color: c.textPrimary }]}>{o.author?.name ?? "게스트"}</Text>
              <Text style={[styles.date, { color: c.textMuted }]}>
                {o.author?.role_title ? `${o.author.role_title} · ` : ""}
                {relativeDate(o.created_at)}
              </Text>
            </View>
          </View>

          {/* 핵심 인사이트(크게) */}
          <Text style={[styles.core, { color: c.textPrimary }]}>{o.insight.core}</Text>

          {/* 구조화 인사이트 */}
          <InsightField label="인상적인 문장" value={o.insight.quote} />
          <InsightField label="내 해석" value={o.insight.interpretation} />
          <InsightField label="바로 적용할 것" value={o.insight.apply} />
          <InsightField label="비슷한 사례" value={o.insight.similar} />
          {o.insight.questions.length > 0 ? (
            <View style={styles.iField}>
              <Text style={[styles.iLabel, { color: c.textMuted }]}>나눌 질문</Text>
              {o.insight.questions.map((qv, i) => (
                <Text key={i} style={[styles.iValue, { color: c.textPrimary }]}>
                  · {qv}
                </Text>
              ))}
            </View>
          ) : null}

          {/* 출처 글 */}
          {a ? (
            <Pressable
              style={[styles.source, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
              onPress={() => nav.navigate("ArticleDetail", { articleId: a.id })}
            >
              <Text style={[styles.sourceLabel, { color: c.textMuted }]}>이 의견이 나온 글</Text>
              <View style={styles.sourceRow}>
                {a.og_image ? (
                  <Image source={{ uri: a.og_image }} style={styles.sourceThumb} resizeMode="cover" />
                ) : (
                  <ServiceLogo name={a.blog?.name ?? "?"} brandColor={a.blog?.brand_color} size={44} />
                )}
                <View style={{ flex: 1 }}>
                  {a.topic ? <TopicChip topic={a.topic} /> : null}
                  <Text style={[styles.sourceTitle, { color: c.textPrimary }]} numberOfLines={2}>
                    {a.title}
                  </Text>
                  <Text style={[styles.sourceBlog, { color: c.textMuted }]}>{a.blog?.name ?? ""}</Text>
                </View>
              </View>
            </Pressable>
          ) : null}

          {/* 토론 */}
          <View style={[styles.discuss, { borderTopColor: c.hairline }]}>
            <Text style={[styles.discussTitle, { color: c.textPrimary }]}>토론 {comments.length}</Text>
            {comments.map((cm) => (
              <View key={cm.id} style={[styles.comment, cm.parent_id ? styles.reply : null]}>
                <Avatar name={cm.author?.name ?? "게스트"} size={30} />
                <View style={{ flex: 1 }}>
                  <View style={styles.cmHead}>
                    <Text style={[styles.cmWho, { color: c.textPrimary }]}>
                      {cm.author?.name ?? "게스트"}
                    </Text>
                    <Text style={[styles.cmDate, { color: c.textMuted }]}>
                      {relativeDate(cm.created_at)}
                    </Text>
                  </View>
                  <Text style={[styles.cmText, { color: c.textSecondary }]}>{cm.text}</Text>
                </View>
              </View>
            ))}
            {comments.length === 0 ? (
              <Text style={[styles.empty, { color: c.textMuted }]}>첫 토론을 시작해보세요</Text>
            ) : null}
          </View>
        </ScrollView>

        {/* 입력 */}
        <View style={[styles.inputBar, { backgroundColor: c.surfaceCard, borderTopColor: c.hairline }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="의견에 답글 달기"
            placeholderTextColor={c.textMuted}
            style={[styles.input, { color: c.textPrimary, backgroundColor: c.surfaceSunken }]}
            multiline
          />
          <Pressable
            onPress={send}
            disabled={!text.trim() || createComment.isPending}
            style={[styles.sendBtn, { backgroundColor: text.trim() ? c.primary : c.surfaceSunken }]}
          >
            <Send size={18} color={text.trim() ? c.actionOn : c.textMuted} />
          </Pressable>
        </View>
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
  hBtn: { width: 44, height: 40, alignItems: "center", justifyContent: "center" },
  hTitle: { ...dtype.title, flex: 1, textAlign: "center" },

  content: { padding: 16, paddingBottom: 24, gap: 14 },
  author: { flexDirection: "row", alignItems: "center", gap: 10 },
  who: { ...dtype.cardTitle },
  date: { ...dtype.meta, marginTop: 2 },
  core: { ...dtype.titleL, fontWeight: "700" },

  iField: { gap: 4 },
  iLabel: { ...dtype.label, fontSize: 12 },
  iValue: { ...dtype.body, lineHeight: 23 },

  source: { borderWidth: 1, borderRadius: 16, padding: 14, gap: 8, marginTop: 4 },
  sourceLabel: { ...dtype.label, fontSize: 12 },
  sourceRow: { flexDirection: "row", gap: 12, alignItems: "center" },
  sourceThumb: { width: 56, height: 56, borderRadius: 10 },
  sourceTitle: { ...dtype.cardTitle, marginTop: 2 },
  sourceBlog: { ...dtype.meta, marginTop: 2 },

  discuss: { marginTop: 8, paddingTop: 16, borderTopWidth: 1, gap: 16 },
  discussTitle: { ...dtype.title },
  comment: { flexDirection: "row", gap: 10 },
  reply: { marginLeft: 32 },
  cmHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  cmWho: { ...dtype.bodyS, fontWeight: "700" },
  cmDate: { ...dtype.meta },
  cmText: { ...dtype.body, marginTop: 3, lineHeight: 22 },
  empty: { ...dtype.body, textAlign: "center", paddingVertical: 12 },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
  },
  input: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 9,
    maxHeight: 100,
    ...dtype.body,
  },
  sendBtn: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
