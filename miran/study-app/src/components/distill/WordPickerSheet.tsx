// distill 단어 저장 시트 — 본문 문장을 길게 눌러 열고, 어려운 단어 칩을 눌러 마이 단어장에 담는다.
//   저장은 즉시(칩에 ✓), AI 뜻풀이는 뒤이어 서버에서 채워져 마이 > 단어장에 표시된다.
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { BookmarkPlus, Check, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useCreateWord } from "@/data";
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
  const [saved, setSaved] = useState<Set<string>>(new Set());

  const words = useMemo(() => (sentence ? tokenizeWords(sentence) : []), [sentence]);

  const save = (term: string) => {
    if (saved.has(term)) return;
    setSaved((p) => new Set(p).add(term));
    create.mutate({ term, context: sentence, articleId });
  };

  return (
    <Modal visible={!!sentence} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: c.surfaceCard }]} onPress={() => {}}>
          <View style={styles.head}>
            <View style={styles.headLeft}>
              <BookmarkPlus size={18} color={c.primary} />
              <Text style={[styles.title, { color: c.textPrimary }]}>단어 저장</Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <X size={20} color={c.textMuted} />
            </Pressable>
          </View>

          <Text style={[styles.hint, { color: c.textMuted }]}>
            어렵거나 알아두면 좋은 단어를 눌러 담아두세요. AI가 뜻을 풀어 마이 · 단어장에 넣어드려요.
          </Text>

          {sentence ? (
            <Text style={[styles.sentence, { color: c.textSecondary, backgroundColor: c.surfaceSunken }]}>
              {sentence}
            </Text>
          ) : null}

          <ScrollView style={{ maxHeight: 220 }} contentContainerStyle={styles.chips}>
            {words.length === 0 ? (
              <Text style={[styles.empty, { color: c.textMuted }]}>고를 만한 단어가 없어요.</Text>
            ) : (
              words.map((w) => {
                const on = saved.has(w);
                return (
                  <Pressable
                    key={w}
                    onPress={() => save(w)}
                    style={[
                      styles.chip,
                      {
                        borderColor: on ? c.primary : c.hairline,
                        backgroundColor: on ? c.primaryTint : "transparent",
                      },
                    ]}
                  >
                    {on ? <Check size={14} color={c.primary} /> : null}
                    <Text style={[styles.chipText, { color: on ? c.primary : c.textPrimary }]}>{w}</Text>
                  </Pressable>
                );
              })
            )}
          </ScrollView>

          {saved.size > 0 ? (
            <Text style={[styles.savedNote, { color: c.primary }]}>
              {saved.size}개 담았어요 · 마이 · 단어장에서 뜻을 확인하세요
            </Text>
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
  savedNote: { ...dtype.meta, fontWeight: "700" },
});
