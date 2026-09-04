// distill 의견 남기기 — 구조화 "핵심 인사이트"(core 필수 + 인용·해석·적용·사례·질문).
//
// 빈 칸을 그냥 보여주면 대부분 여기서 나간다. 그래서 진입을 3단 사다리로 만든다:
//   ① 하이라이트를 그었다 → **초안이 채워진 폼**(밑줄 친 문장 + 메모로 미리 채움)
//   ② 하이라이트 없음      → **질문 1개**(결정 카드에서 조립된 것만 넘어온다)
//   ③ 둘 다 부담          → 글 상세의 원탭 스탬프(이 화면에 안 들어옴)
// 핵심: 초안 재료는 **내가 직접 밑줄 그은 문장**이다. 글 전체 요약이 아니라
// "내가 이 글에서 본 것"이라 고칠 마음이 생긴다.
import React, { useEffect, useMemo, useState } from "react";
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
import { ChevronLeft } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { useCreateOpinion, useArticleHighlights, useArticle } from "@/data";
import { cleanInsight, EMPTY_INSIGHT, type Insight } from "@/lib/insight";
import { draftFromHighlights } from "@/lib/insightDraft";
import { questionFromDecision } from "@/lib/decision";
import { applyQuestion, fallbackQuestion } from "@/lib/improvement";
import { dtype , PRETENDARD} from "@/theme";

type Props = NativeStackScreenProps<RootStackParamList, "CreateOpinion">;

/**
 * AI 가 뽑아준 질문 한 개 + 그 답을 쓰는 칸.
 *
 * ⚠️ 빈 칸("인상 깊은 부분")을 주는 대신 **질문**을 준다. 빈 상자를 앞에 두면 대부분
 *    거기서 나간다 — 무엇을 써야 할지 모르기 때문이다. 질문은 그 자리에서 답이 떠오른다.
 */
function QuestionBlock({
  step,
  label,
  question,
  value,
  onChangeText,
  placeholder,
}: {
  step: string;
  label: string;
  question: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.qBlock, { borderColor: c.accentTintBorder, backgroundColor: c.primaryTint }]}>
      <Text style={[styles.qLabel, { color: c.primary }]}>
        {step}. {label}
      </Text>
      <Text style={[styles.qText, { color: c.textPrimary }]}>{question}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={c.textMuted}
        multiline
        style={[
          styles.input,
          styles.inputMulti,
          { color: c.textPrimary, borderColor: c.hairline, backgroundColor: c.surfaceCard },
        ]}
      />
    </View>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  required,
  hint,
  multiline = true,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  required?: boolean;
  /** 라벨 아래 붙는 안내(생각해볼 질문). 입력창과 한 덩어리로 보이게 한다. */
  hint?: string | null;
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
      {hint ? <Text style={[styles.hint, { color: c.primary }]}>{hint}</Text> : null}
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
  const highlightsQ = useArticleHighlights(articleId); // 본인 것만 반환하는 훅
  const articleQ = useArticle(articleId);

  // 질문은 **여기서 직접 조립**한다. 예전엔 route.params 로 받았는데,
  //   하단 CTA("내 생각도 남겨볼까요?")와 글 등록 직후 경로가 그 값을 안 넘겨서
  //   그쪽으로 들어오면 질문이 아예 안 떴다(실측 버그).
  //
  // ⚠️ **질문은 항상 있다.** 대조쌍(A 대신 B)이 있는 글은 779건 중 15건뿐이라,
  //    예전엔 나머지 글에서 질문 칸이 통째로 사라졌다. 재료가 없으면 폴백 사다리로
  //    내려가되 끝까지 "답할 수 있는" 질문을 준다(lib/improvement.fallbackQuestion).
  const qInput = {
    decision: articleQ.data?.decision,
    title: articleQ.data?.title,
    tags: articleQ.data?.tags,
  };
  // ① 이 글에서 **무엇을 봤나** — 인사이트를 끄집어내는 질문.
  const question =
    questionFromDecision(articleQ.data?.decision, articleQ.data?.blog?.name) ??
    fallbackQuestion(qInput);
  // ② 그래서 **우리는 무엇을 하나** — 접목을 끄집어내는 질문.
  //    읽고 끝나면 남는 게 없다. 이 앱이 팔아야 할 건 결국 두 번째 질문의 답이다.
  const question2 = applyQuestion(qInput);

  const [insight, setInsight] = useState<Insight>({ ...EMPTY_INSIGHT });
  // 두 질문의 답. ①은 핵심 인사이트(core), ②는 접목(apply) 으로 그대로 저장된다.
  //   따로 "인상 깊은 부분"·"접목하고 싶은 방법" 빈 칸을 또 두지 않는다 — 같은 걸 두 번 묻는 꼴이라
  //   빈 폼만 늘어나고 아무도 안 채웠다.
  const [answer, setAnswer] = useState("");
  const [answer2, setAnswer2] = useState("");
  const [prefilled, setPrefilled] = useState(false);
  const set = (patch: Partial<Insight>) => setInsight((p) => ({ ...p, ...patch }));

  const draft = useMemo(
    () => draftFromHighlights(highlightsQ.data ?? []),
    [highlightsQ.data],
  );

  // 하이라이트가 오면 **한 번만** 초안을 채운다(사용자가 고친 뒤 덮어쓰지 않게).
  useEffect(() => {
    if (prefilled || draft.usedCount === 0) return;
    setInsight((p) => ({
      ...p,
      quote: p.quote || draft.insight.quote,
      interpretation: p.interpretation || draft.insight.interpretation,
    }));
    // 밑줄 메모는 ①번 질문의 답 칸으로 넣는다 — 그게 지금 화면에서 "핵심"을 받는 칸이다.
    setAnswer((a) => a || draft.insight.core);
    setPrefilled(true);
  }, [draft, prefilled]);

  // 질문 하나에만 답해도 저장할 수 있어야 한다 — 그게 이 화면의 가장 쉬운 입구다.
  const canSave =
    (answer.trim().length > 0 || answer2.trim().length > 0) && !create.isPending;

  const save = () => {
    const a = answer.trim();
    const a2 = answer2.trim();
    const merged: Insight = {
      ...insight,
      // ①의 답이 핵심 인사이트. 비었으면 ②의 답을 올린다(빈 저장 방지).
      core: a || a2,
      // ②의 답이 "바로 적용할 것".
      apply: a2,
      // 질문과 답을 함께 남겨야 나중에 읽을 때 맥락이 산다.
      interpretation: [insight.interpretation, a ? `${question}\n→ ${a}` : "", a2 ? `${question2}\n→ ${a2}` : ""]
        .filter(Boolean)
        .join("\n\n"),
    };
    const clean = cleanInsight(merged);
    if (!clean) return;
    create.mutate(clean, { onSuccess: () => nav.goBack() });
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
        <Text style={[styles.hTitle, { color: c.textPrimary }]}>인사이트 쓰기</Text>
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
          {/* ① 하이라이트 초안 — 밑줄 친 문장을 그대로 보여주고(수정 불가, 저장은 됨)
                 메모가 있으면 아래 칸이 이미 채워져 있다. 사람은 고치기만 하면 된다. */}
          {draft.usedCount > 0 && insight.quote ? (
            <View style={[styles.draftCard, { backgroundColor: c.primaryTint, borderColor: c.accentTintBorder }]}>
              <Text style={[styles.draftLabel, { color: c.primary }]}>내가 밑줄 그은 문장</Text>
              <Text style={[styles.draftQuote, { color: c.textPrimary }]}>“{insight.quote}”</Text>
              <Text style={[styles.draftHint, { color: c.textMuted }]}>
                밑줄 {draft.usedCount}개 중 가장 길게 그은 문장이에요. 이 글에 함께 저장돼요.
              </Text>
            </View>
          ) : null}

          {/* ② 질문 두 개 — **하나는 이 글에서 무엇을 봤나, 하나는 그래서 우리는 무엇을 하나.**
                 예전엔 질문 하나 + 빈 칸 3개("인상 깊은 부분"·"접목하고 싶은 방법"·"질문·토론")
                 였는데, 앞의 둘은 질문이 묻는 것과 같은 내용이라 같은 걸 두 번 묻는 꼴이었다.
                 빈 칸을 없애고 질문에 답하게 한다 — 빈 상자보다 질문이 훨씬 쓰기 쉽다. */}
          <QuestionBlock
            step="1"
            label="이 글에서 무엇을 보셨나요?"
            question={question}
            value={answer}
            onChangeText={setAnswer}
            placeholder="한 문장이어도 괜찮아요"
          />
          <QuestionBlock
            step="2"
            label="그래서 우리 일엔 어떻게 쓸까요?"
            question={question2}
            value={answer2}
            onChangeText={setAnswer2}
            placeholder="떠오르는 대로 적어도 괜찮아요"
          />

          {/* ③ 여기서부터는 자유롭게 — 정해진 틀 없이 나누고 싶은 말. */}
          <Field
            label="질문 · 토론하고 싶은 것"
            value={insight.questions[0] ?? ""}
            onChangeText={(t) => set({ questions: t ? [t] : [] })}
            placeholder="인사이터들과 자유롭게 나누고 싶은 이야기"
          />
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
  draft: { ...dtype.bodyS, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  draftCard: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 6 },
  draftLabel: { ...dtype.label, fontSize: 12 },
  draftQuote: { ...dtype.body, lineHeight: 24, fontWeight: "600", fontFamily: PRETENDARD["600"] },
  draftQuestion: { ...dtype.cardTitle, fontSize: 16, lineHeight: 24 },
  draftHint: { ...dtype.meta },

  content: { padding: 16, gap: 18, paddingBottom: 40 },
  field: { gap: 8 },
  label: { ...dtype.label, fontSize: 13 },
  hint: { ...dtype.bodyS, fontSize: 13.5, lineHeight: 20, marginTop: -2 },
  qBlock: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 8, marginBottom: 4 },
  qLabel: { ...dtype.label },
  qText: { ...dtype.cardTitle, lineHeight: 23 },
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
  addQText: { ...dtype.bodyS, fontWeight: "700", fontFamily: PRETENDARD["700"] },
});
