// 온보딩 — 구글 로그인 직후 딱 1화면. 직무 + 관심 주제만 받는다.
//
// 여기서 받는 **직무(job_role) 하나로** 아래 셋이 전부 돌아간다:
//   ① 역할별 AI 요약   — 같은 글도 기획자에게는 판단 과정으로, 개발자에게는 구현으로 요약
//   ② 직군 배지        — "기획자 12명이 이 글을 읽었어요"
//   ③ 단어장 개인화    — 그 사람 직무 언어로 뜻풀이를 다시 쓴다
// 그래서 이 화면이 나머지 기능의 전제다. 대신 질문은 2개를 넘기지 않는다.
import React, { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useTheme } from "@/providers/ThemeProvider";
import { JOB_ROLE_META, JOB_ROLE_ORDER, TOPIC_META, TOPIC_ORDER, dtype } from "@/theme";
import { useCompleteOnboarding, useProfile } from "@/data";
import type { JobRole, Topic } from "@/types/database";

export function OnboardingScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const profileQ = useProfile();
  const complete = useCompleteOnboarding();

  const [role, setRole] = useState<JobRole | null>(null);
  const [topics, setTopics] = useState<Set<Topic>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const name = profileQ.data?.name?.trim();
  const greeting = name && name !== "게스트" ? `${name}님, 반가워요!` : "반가워요!";

  const toggleTopic = (t: Topic) => {
    setTopics((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      return next;
    });
  };

  const onSubmit = () => {
    if (!role || complete.isPending) return;
    setError(null);
    complete.mutate(
      { jobRole: role, topics: [...topics] },
      {
        // 성공하면 프로필의 onboarded_at 이 채워지고 게이트가 앱 본화면으로 넘긴다.
        onError: (e) =>
          setError(e instanceof Error ? e.message : "저장에 실패했어요. 다시 시도해주세요."),
      },
    );
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: c.textPrimary }]}>{greeting}</Text>
        <Text style={[styles.sub, { color: c.textMuted }]}>
          어떤 일을 하시는지 알려주시면{"\n"}그 관점에 맞춰 글을 정리해 드려요.
        </Text>

        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>어떤 일을 하세요?</Text>
        <View style={styles.grid}>
          {JOB_ROLE_ORDER.map((r) => {
            const meta = JOB_ROLE_META[r];
            const on = role === r;
            return (
              <Pressable
                key={r}
                onPress={() => setRole(r)}
                style={[
                  styles.roleCell,
                  {
                    backgroundColor: on ? c.primaryTint : c.surfaceCard,
                    borderColor: on ? c.primary : c.hairline,
                  },
                ]}
              >
                <Text style={styles.roleEmoji}>{meta.emoji}</Text>
                <Text style={[styles.roleLabel, { color: on ? c.primary : c.textPrimary }]}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.sectionTitle, { color: c.textPrimary }]}>
          관심 주제를 골라주세요
        </Text>
        <Text style={[styles.sectionHint, { color: c.textMuted }]}>
          여러 개 골라도 돼요. 나중에 바꿀 수 있어요.
        </Text>
        <View style={styles.chips}>
          {TOPIC_ORDER.map((t) => {
            const meta = TOPIC_META[t];
            const on = topics.has(t);
            return (
              <Pressable
                key={t}
                onPress={() => toggleTopic(t)}
                style={[
                  styles.topicChip,
                  {
                    backgroundColor: on ? meta.tint : c.surfaceCard,
                    borderColor: on ? meta.color : c.hairline,
                  },
                ]}
              >
                <Text style={[styles.topicText, { color: on ? meta.color : c.textSecondary }]}>
                  {meta.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {error ? <Text style={[styles.error, { color: c.danger }]}>{error}</Text> : null}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: c.hairline, backgroundColor: c.surfacePage }]}>
        <Pressable
          onPress={onSubmit}
          disabled={!role || complete.isPending}
          style={[
            styles.cta,
            { backgroundColor: role ? c.primary : c.surfaceSunken, opacity: complete.isPending ? 0.7 : 1 },
          ]}
        >
          {complete.isPending ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={[styles.ctaText, { color: role ? "#fff" : c.textMuted }]}>
              {role ? "시작하기" : "직무를 골라주세요"}
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 24 },
  title: { ...dtype.display },
  sub: { ...dtype.body, marginTop: 8, lineHeight: 24 },

  sectionTitle: { ...dtype.title, marginTop: 32 },
  sectionHint: { ...dtype.meta, marginTop: 4 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14 },
  roleCell: {
    flexGrow: 1,
    flexBasis: "30%",
    minHeight: 84,
    borderWidth: 1.5,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
  },
  roleEmoji: { fontSize: 24 },
  roleLabel: { ...dtype.cardTitle, fontSize: 15 },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 14 },
  topicChip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, minHeight: 38, justifyContent: "center" },
  topicText: { ...dtype.label, fontSize: 13.5 },

  error: { ...dtype.bodyS, marginTop: 16 },

  footer: { borderTopWidth: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 8 },
  cta: { height: 52, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  ctaText: { ...dtype.cardTitle, fontSize: 16 },
});
