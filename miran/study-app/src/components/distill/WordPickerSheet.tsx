// distill 단어 저장 시트 — 본문 문장을 길게 눌러 열고, 어려운 단어 칩을 눌러 담는다.
//   단어를 누르면 즉시 저장(✓)되고, 그 자리에서 AI 뜻풀이가 채워져 표시된다(마이 단어장에도 담김).
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { BookmarkPlus, Check, RotateCw, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useCreateWord, useWordByTerm, useDefineWord } from "@/data";
import { tokenizeWords } from "@/lib/text";
import { dtype } from "@/theme";

export function WordPickerSheet({
  sentence,
  articleId,
  onClose,
}: {
  sentence: string | null;
  articleId: string;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const create = useCreateWord();
  const define = useDefineWord();
  const [saved, setSaved] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<string | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const wordQ = useWordByTerm(active);

  // 뜻풀이가 ~20초 안에 안 오면 '포기'로 전환(무한 로딩 대신 재시도 버튼 노출).
  useEffect(() => {
    setGaveUp(false);
    if (!active) return;
    const t = setTimeout(() => setGaveUp(true), 20000);
    return () => clearTimeout(t);
  }, [active, retryTick]);

  const words = useMemo(() => (sentence ? tokenizeWords(sentence) : []), [sentence]);

  const pick = (term: string) => {
    setActive(term); // 누른 단어의 뜻을 보여줌
    if (!saved.has(term)) {
      setSaved((p) => new Set(p).add(term));
      create.mutate({ term, context: sentence, articleId });
    }
  };

  const close = () => {
    setActive(null);
    onClose();
  };

  return (
    <Modal visible={!!sentence} transparent animationType="slide" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={[styles.sheet, { backgroundColor: c.surfaceCard }]} onPress={() => {}}>
          <View style={styles.head}>
            <View style={styles.headLeft}>
              <BookmarkPlus size={18} color={c.primary} />
              <Text style={[styles.title, { color: c.textPrimary }]}>단어 저장</Text>
            </View>
            <Pressable onPress={close} hitSlop={8}>
              <X size={20} color={c.textMuted} />
            </Pressable>
          </View>

          <Text style={[styles.hint, { color: c.textMuted }]}>
            어렵거나 알아두면 좋은 단어를 눌러보세요. 담아두고 AI 뜻풀이를 바로 보여드려요.
          </Text>

          {sentence ? (
            <Text style={[styles.sentence, { color: c.textSecondary, backgroundColor: c.surfaceSunken }]}>
              {sentence}
            </Text>
          ) : null}

          <ScrollView style={{ maxHeight: 160 }} contentContainerStyle={styles.chips}>
            {words.length === 0 ? (
              <Text style={[styles.empty, { color: c.textMuted }]}>고를 만한 단어가 없어요.</Text>
            ) : (
              words.map((w) => {
                const on = saved.has(w);
                const isActive = active === w;
                return (
                  <Pressable
                    key={w}
                    onPress={() => pick(w)}
                    style={[
                      styles.chip,
                      {
                        borderColor: isActive || on ? c.primary : c.hairline,
                        backgroundColor: isActive ? c.primary : on ? c.primaryTint : "transparent",
                      },
                    ]}
                  >
                    {on ? <Check size={14} color={isActive ? c.actionOn : c.primary} /> : null}
                    <Text
                      style={[
                        styles.chipText,
                        { color: isActive ? c.actionOn : on ? c.primary : c.textPrimary },
                      ]}
                    >
                      {w}
                    </Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {/* 누른 단어의 뜻풀이 */}
          {active ? (
            <View style={[styles.defPanel, { backgroundColor: c.surfaceSunken }]}>
              <Text style={[styles.defTerm, { color: c.primary }]}>{active}</Text>
              {wordQ.data?.definition ? (
                <Text style={[styles.defText, { color: c.textPrimary }]}>{wordQ.data.definition}</Text>
              ) : gaveUp && !define.isPending && wordQ.data ? (
                <Pressable
                  style={styles.defLoading}
                  onPress={() => {
                    setRetryTick((t) => t + 1);
                    define.mutate(wordQ.data!.id);
                  }}
                >
                  <RotateCw size={14} color={c.primary} />
                  <Text style={[styles.defLoadingText, { color: c.primary }]}>
                    뜻풀이를 못 만들었어요. 다시 시도
                  </Text>
                </Pressable>
              ) : (
                <View style={styles.defLoading}>
                  <ActivityIndicator size="small" color={c.primary} />
                  <Text style={[styles.defLoadingText, { color: c.textMuted }]}>
                    AI가 뜻을 풀고 있어요…
                  </Text>
                </View>
              )}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  headLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { ...dtype.title, fontSize: 16 },
  hint: { ...dtype.bodyS, lineHeight: 19 },
  sentence: { ...dtype.bodyS, lineHeight: 21, borderRadius: 10, padding: 12, overflow: "hidden" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 2 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  chipText: { ...dtype.label, fontSize: 14 },
  empty: { ...dtype.bodyS, paddingVertical: 12 },

  defPanel: { borderRadius: 12, padding: 14, gap: 6 },
  defTerm: { ...dtype.cardTitle, fontSize: 15 },
  defText: { ...dtype.body, lineHeight: 23 },
  defLoading: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 2 },
  defLoadingText: { ...dtype.bodyS },
});
