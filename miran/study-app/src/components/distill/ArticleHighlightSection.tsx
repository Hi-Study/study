// distill 원문 문장 하이라이트 — 문장을 눌러 밑줄+감상(모두에게 공유). article_highlights 기반.
// 기존 HighlightSection(share 기반)과 동일한 UX를 article 전역판으로 재현.
import { useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Highlighter, Trash2, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useUid } from "@/auth/AuthProvider";
import {
  useArticleHighlights,
  useUpsertArticleHighlight,
  useDeleteArticleHighlight,
  type ArticleHighlightRow,
} from "@/data";
import { splitSentences, groupSentencesIntoBlocks } from "@/lib/text";
import { HIGHLIGHT_COLORS, HIGHLIGHT_TEXT, highlightBg } from "@/lib/highlight";
import { Avatar } from "@/components/Avatar";
import { WordPickerSheet } from "@/components/distill/WordPickerSheet";

export function ArticleHighlightSection({
  articleId,
  text,
}: {
  articleId: string;
  text: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const uid = useUid();
  const highlights = useArticleHighlights(articleId);
  const upsert = useUpsertArticleHighlight(articleId);
  const del = useDeleteArticleHighlight(articleId);
  const [active, setActive] = useState<{ index: number; quote: string } | null>(null);
  const [wordSentence, setWordSentence] = useState<string | null>(null);

  const list = highlights.data ?? [];
  const sentenceHls = active ? list.filter((h) => h.sentence_index === active.index) : [];

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Highlighter size={14} color={c.primary} />
        <Text style={[styles.headText, { color: c.primary }]}>
          눌러서 밑줄·감상 · 길게 눌러 단어 저장
        </Text>
      </View>

      <HighlightableText
        text={text}
        highlights={list}
        myUid={uid}
        activeIndex={active?.index ?? null}
        onTap={(index, quote) => setActive({ index, quote })}
        onLongPress={(quote) => setWordSentence(quote)}
      />

      {list.length > 0 ? (
        <View style={[styles.rollup, { borderTopColor: c.hairline }]}>
          <Text style={[styles.rollupTitle, { color: c.textSecondary }]}>밑줄 & 감상 {list.length}</Text>
          {list
            .slice()
            .sort((a, b) => a.sentence_index - b.sentence_index)
            .map((h) => (
              <Pressable
                key={h.id}
                onPress={() => setActive({ index: h.sentence_index, quote: h.quote ?? "" })}
                style={[styles.rollupRow, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
              >
                <View style={[styles.rollupBar, { backgroundColor: highlightBg(h.color) }]} />
                <Avatar name={h.author?.name ?? "게스트"} size={28} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rollupWho, { color: c.textPrimary }]}>
                    {h.author_id === uid ? "나" : h.author?.name ?? "게스트"}
                  </Text>
                  {h.quote ? (
                    <Text numberOfLines={1} style={[styles.rollupQuote, { color: c.textMuted }]}>
                      “{h.quote}”
                    </Text>
                  ) : null}
                  {h.note ? (
                    <Text style={[styles.rollupNote, { color: c.textSecondary }]}>{h.note}</Text>
                  ) : null}
                </View>
              </Pressable>
            ))}
        </View>
      ) : null}

      <Modal visible={!!active} transparent animationType="slide" onRequestClose={() => setActive(null)}>
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <Pressable style={styles.backdrop} onPress={() => setActive(null)}>
            <Pressable style={[styles.sheet, { backgroundColor: c.surfaceCard }]} onPress={() => {}}>
              {active ? (
                <SheetBody
                  key={active.index}
                  quote={active.quote}
                  highlights={sentenceHls}
                  myUid={uid}
                  pending={upsert.isPending || del.isPending}
                  onClose={() => setActive(null)}
                  onSave={(color, note) =>
                    upsert.mutate(
                      { sentenceIndex: active.index, quote: active.quote, color, note },
                      { onSuccess: () => setActive(null) },
                    )
                  }
                  onDelete={(id) => del.mutate(id, { onSuccess: () => setActive(null) })}
                />
              ) : null}
            </Pressable>
          </Pressable>
        </KeyboardAvoidingView>
      </Modal>

      <WordPickerSheet
        sentence={wordSentence}
        articleId={articleId}
        onClose={() => setWordSentence(null)}
      />
    </View>
  );
}

function HighlightableText({
  text,
  highlights,
  myUid,
  activeIndex,
  onTap,
  onLongPress,
}: {
  text: string;
  highlights: ArticleHighlightRow[];
  myUid: string;
  activeIndex: number | null;
  onTap: (index: number, quote: string) => void;
  onLongPress: (quote: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const sentences = useMemo(() => splitSentences(text), [text]);
  const blocks = useMemo(() => groupSentencesIntoBlocks(sentences), [sentences]);
  const byIndex = useMemo(() => {
    const m = new Map<number, ArticleHighlightRow[]>();
    for (const h of highlights) {
      const a = m.get(h.sentence_index) ?? [];
      a.push(h);
      m.set(h.sentence_index, a);
    }
    return m;
  }, [highlights]);

  // 문장 한 조각 렌더 — 전역 index 로 탭/롱프레스·밑줄 표시(블록으로 묶여도 동일).
  const renderSentence = ({ index: i, seg }: { index: number; seg: string }) => {
    const display = seg.replace(/\n+$/, ""); // 줄 끝 개행은 블록 간격이 대신
    const isActive = i === activeIndex;
    const hs = byIndex.get(i);
    const marked = hs && hs.length > 0;
    const style = isActive
      ? { backgroundColor: c.primary, color: "#ffffff" }
      : marked
        ? { backgroundColor: highlightBg(hs![0].color), color: HIGHLIGHT_TEXT }
        : undefined;
    const names = marked
      ? hs!.map((h) => (h.author_id === myUid ? "나" : h.author?.name ?? "게스트")).join("·")
      : "";
    return (
      <Text
        key={i}
        onPress={() => onTap(i, seg.trim())}
        onLongPress={() => onLongPress(seg.trim())}
        style={style}
      >
        {display}
        {marked ? (
          <Text style={[styles.inlineAuthor, { color: isActive ? "#ffffff" : c.primary }]}>
            {" ✎"}
            {names}
          </Text>
        ) : null}
      </Text>
    );
  };

  return (
    <View style={styles.blocks}>
      {blocks.map((b, bi) => (
        <Text
          key={bi}
          style={[
            b.kind === "heading" ? styles.blockHeading : styles.blockPara,
            b.kind === "list" && styles.blockList,
            { color: c.textPrimary },
          ]}
        >
          {b.items.map(renderSentence)}
        </Text>
      ))}
    </View>
  );
}

function SheetBody({
  quote,
  highlights,
  myUid,
  pending,
  onClose,
  onSave,
  onDelete,
}: {
  quote: string;
  highlights: ArticleHighlightRow[];
  myUid: string;
  pending: boolean;
  onClose: () => void;
  onSave: (color: string, note: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const mine = highlights.find((h) => h.author_id === myUid);
  const others = highlights.filter((h) => h.author_id !== myUid);
  const [color, setColor] = useState<string>(mine?.color ?? "yellow");
  const [note, setNote] = useState<string>(mine?.note ?? "");

  return (
    <View>
      <View style={styles.sheetHead}>
        <Text style={[styles.sheetTitle, { color: c.textPrimary }]}>밑줄 & 감상</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <X size={20} color={c.textMuted} />
        </Pressable>
      </View>

      <Text style={[styles.sheetLabel, { color: c.textMuted }]}>색 고르기</Text>
      <View style={styles.swatches}>
        {HIGHLIGHT_COLORS.map((hc) => (
          <Pressable
            key={hc.key}
            onPress={() => setColor(hc.key)}
            style={[
              styles.swatch,
              { backgroundColor: hc.bg },
              color === hc.key && { borderColor: c.primary, borderWidth: 3 },
            ]}
          />
        ))}
      </View>

      <Text style={[styles.quote, { backgroundColor: highlightBg(color), color: HIGHLIGHT_TEXT }]}>
        “{quote}”
      </Text>

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="감상평 (선택)"
        placeholderTextColor={c.textMuted}
        multiline
        style={[styles.noteInput, { color: c.textPrimary, borderColor: c.hairline }]}
      />

      <View style={styles.actions}>
        {mine ? (
          <Pressable
            onPress={() => onDelete(mine.id)}
            disabled={pending}
            style={[styles.delBtn, { borderColor: c.danger }]}
          >
            <Trash2 size={15} color={c.danger} />
            <Text style={{ color: c.danger, fontSize: 14, fontWeight: "700" }}>삭제</Text>
          </Pressable>
        ) : null}
        <Pressable
          onPress={() => onSave(color, note.trim() || null)}
          disabled={pending}
          style={[styles.saveBtn, { backgroundColor: c.primary, opacity: pending ? 0.6 : 1 }]}
        >
          <Text style={styles.saveText}>{mine ? "수정" : "밑줄 긋기"}</Text>
        </Pressable>
      </View>

      <ScrollView style={{ maxHeight: 170 }} keyboardShouldPersistTaps="handled">
        {others.length > 0 ? (
          <Text style={[styles.otherLabel, { color: c.textMuted }]}>다른 사람 밑줄 {others.length}</Text>
        ) : null}
        {others.map((h) => (
          <View key={h.id} style={[styles.other, { backgroundColor: c.surfacePage }]}>
            <View style={[styles.otherBar, { backgroundColor: highlightBg(h.color) }]} />
            <Avatar name={h.author?.name ?? "게스트"} size={28} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.otherName, { color: c.textPrimary }]}>{h.author?.name ?? "게스트"}</Text>
              {h.note ? (
                <Text style={[styles.otherNote, { color: c.textSecondary }]}>{h.note}</Text>
              ) : (
                <Text style={[styles.otherNote, { color: c.textMuted }]}>밑줄만 그었어요</Text>
              )}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { marginTop: 8, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  headText: { fontSize: 12.5, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 26 },
  blocks: { gap: 14 },
  blockPara: { fontSize: 15.5, lineHeight: 27 },
  blockHeading: { fontSize: 17, lineHeight: 25, fontWeight: "800", marginTop: 4 },
  blockList: { paddingLeft: 10 },
  inlineAuthor: { fontSize: 11, fontWeight: "800" },

  rollup: { marginTop: 14, paddingTop: 16, borderTopWidth: 1, gap: 12 },
  rollupTitle: { fontSize: 12.5, fontWeight: "800", letterSpacing: 0.2 },
  rollupRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  rollupBar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  rollupWho: { fontSize: 14, fontWeight: "800" },
  rollupQuote: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  rollupNote: { fontSize: 13.5, lineHeight: 19, marginTop: 5 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, gap: 12 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 16, fontWeight: "700" },
  sheetLabel: { fontSize: 12, fontWeight: "700", marginTop: 2 },
  quote: { fontSize: 14.5, lineHeight: 22, borderRadius: 8, padding: 10, overflow: "hidden" },
  otherLabel: { fontSize: 12, fontWeight: "800", marginTop: 2, marginBottom: 8 },
  other: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 10, borderRadius: 10, overflow: "hidden", marginBottom: 8 },
  otherBar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  otherName: { fontSize: 13.5, fontWeight: "800" },
  otherNote: { fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  swatches: { flexDirection: "row", gap: 10, marginTop: 2 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  noteInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, minHeight: 60, maxHeight: 120 },
  actions: { flexDirection: "row", gap: 10, marginTop: 2 },
  delBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  saveBtn: { flex: 1, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});
