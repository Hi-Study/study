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
  useHighlights,
  useUpsertHighlight,
  useDeleteHighlight,
  type HighlightRow,
} from "@/data/highlights";
import { splitSentences } from "@/lib/text";
import { HIGHLIGHT_COLORS, HIGHLIGHT_TEXT, highlightBg } from "@/lib/highlight";
import { Avatar } from "./Avatar";
import { PRETENDARD } from "@/theme";

/** 공유 글 본문을 문장 단위로 밑줄 긋고 감상평을 남기는 섹션(피그마 코멘트식, 모두에게 공유). */
export function HighlightSection({
  shareId,
  studyId,
  text,
  collapsible = false,
}: {
  shareId: string;
  studyId: string;
  text: string;
  collapsible?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const uid = useUid();
  const highlights = useHighlights(shareId);
  const upsert = useUpsertHighlight(shareId);
  const del = useDeleteHighlight(shareId);
  const [active, setActive] = useState<{ index: number; quote: string } | null>(null);
  const [open, setOpen] = useState(!collapsible);

  const list = highlights.data ?? [];
  const count = list.length;

  if (collapsible && !open) {
    return (
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.openBtn, { borderColor: c.hairline, backgroundColor: c.surfaceCard }]}
      >
        <Highlighter size={16} color={c.primary} />
        <Text style={[styles.openText, { color: c.textPrimary }]}>
          밑줄 그으며 읽기{count > 0 ? ` · 밑줄 ${count}` : ""}
        </Text>
      </Pressable>
    );
  }

  const sentenceHls = active ? list.filter((h) => h.sentence_index === active.index) : [];

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Highlighter size={14} color={c.primary} />
        <Text style={[styles.headText, { color: c.primary }]}>
          문장을 눌러 밑줄 긋고 감상 남기기
        </Text>
      </View>
      <HighlightableText
        text={text}
        highlights={list}
        myUid={uid}
        activeIndex={active?.index ?? null}
        onTap={(index, quote) => setActive({ index, quote })}
      />

      {/* 밑줄 모아보기 — 누가 어느 문장에 뭐라 남겼는지 한눈에 */}
      {list.length > 0 ? (
        <View style={[styles.rollup, { borderTopColor: c.hairline }]}>
          <Text style={[styles.rollupTitle, { color: c.textSecondary }]}>
            밑줄 & 감상 {list.length}
          </Text>
          {list
            .slice()
            .sort((a, b) => a.sentence_index - b.sentence_index)
            .map((h) => (
              <Pressable
                key={h.id}
                onPress={() => setActive({ index: h.sentence_index, quote: h.quote ?? "" })}
                style={[styles.rollupRow, { backgroundColor: c.surfacePage }]}
              >
                <View style={[styles.rollupBar, { backgroundColor: highlightBg(h.color) }]} />
                <Avatar name={h.author?.name ?? "멤버"} size={28} square />
                <View style={{ flex: 1 }}>
                  <View style={styles.rollupWhoRow}>
                    <Text style={[styles.rollupWho, { color: c.textPrimary }]}>
                      {h.author_id === uid ? "나" : h.author?.name ?? "멤버"}
                    </Text>
                    <View style={[styles.rollupDot, { backgroundColor: highlightBg(h.color) }]} />
                  </View>
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

      <Modal
        visible={!!active}
        transparent
        animationType="slide"
        onRequestClose={() => setActive(null)}
      >
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <Pressable style={styles.backdrop} onPress={() => setActive(null)}>
            <Pressable
              style={[styles.sheet, { backgroundColor: c.surfaceCard }]}
              onPress={() => {}}
            >
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
                      { studyId, sentenceIndex: active.index, quote: active.quote, color, note },
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
    </View>
  );
}

/** 본문을 문장 조각으로 렌더 — 밑줄된 문장은 형광색 배경, 누르면 onTap. */
function HighlightableText({
  text,
  highlights,
  myUid,
  activeIndex,
  onTap,
}: {
  text: string;
  highlights: HighlightRow[];
  myUid: string;
  activeIndex: number | null;
  onTap: (index: number, quote: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const sentences = useMemo(() => splitSentences(text), [text]);
  const byIndex = useMemo(() => {
    const m = new Map<number, HighlightRow[]>();
    for (const h of highlights) {
      const a = m.get(h.sentence_index) ?? [];
      a.push(h);
      m.set(h.sentence_index, a);
    }
    return m;
  }, [highlights]);

  return (
    <Text style={[styles.body, { color: c.textPrimary }]}>
      {sentences.map((s, i) => {
        if (s.trim() === "") return <Text key={i}>{s}</Text>;
        // 지금 고른 문장 = 보라 배경 + 흰 글자로 강하게(선택 범위 명확히).
        const isActive = i === activeIndex;
        const hs = byIndex.get(i);
        const marked = hs && hs.length > 0;
        const style = isActive
          ? { backgroundColor: c.primary, color: "#ffffff" }
          : marked
            ? { backgroundColor: highlightBg(hs![0].color), color: HIGHLIGHT_TEXT }
            : undefined;
        // 밑줄 친 문장 뒤에 작성자 이름을 바로 붙여 "누가 달았는지" 직관적으로.
        const names = marked
          ? hs!.map((h) => (h.author_id === myUid ? "나" : h.author?.name ?? "멤버")).join("·")
          : "";
        return (
          <Text key={i} onPress={() => onTap(i, s.trim())} style={style}>
            {s}
            {marked ? (
              <Text style={[styles.inlineAuthor, { color: isActive ? "#ffffff" : c.primary }]}>
                {" ✎"}
                {names}
              </Text>
            ) : null}
          </Text>
        );
      })}
    </Text>
  );
}

/** 시트 내용 — 인용 문장 + 다른 사람 감상 + 내 밑줄/감상 편집. */
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
  highlights: HighlightRow[];
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

      {/* 1. 색 고르기 */}
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

      {/* 2. 선택한 문장(고른 색으로 미리보기) */}
      <Text style={[styles.quote, { backgroundColor: highlightBg(color), color: HIGHLIGHT_TEXT }]}>
        “{quote}”
      </Text>

      {/* 3. 감상평 */}
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
            style={[styles.delBtn, { borderColor: "#c0392b" }]}
          >
            <Trash2 size={15} color="#c0392b" />
            <Text style={{ color: "#c0392b", fontSize: 14, fontWeight: "700", fontFamily: PRETENDARD["700"] }}>삭제</Text>
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

      {/* 다른 사람 밑줄(여러 명이면 한 명씩) — 하단 컨텍스트 */}
      <ScrollView style={{ maxHeight: 170 }} keyboardShouldPersistTaps="handled">
        {others.length > 0 ? (
          <Text style={[styles.otherLabel, { color: c.textMuted }]}>
            다른 사람 밑줄 {others.length}
          </Text>
        ) : null}
        {others.map((h) => (
          <View key={h.id} style={[styles.other, { backgroundColor: c.surfacePage }]}>
            <View style={[styles.otherBar, { backgroundColor: highlightBg(h.color) }]} />
            <Avatar name={h.author?.name ?? "멤버"} size={28} square />
            <View style={{ flex: 1 }}>
              <Text style={[styles.otherName, { color: c.textPrimary }]}>
                {h.author?.name ?? "멤버"}
              </Text>
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
  section: { marginTop: 12, gap: 8 },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  headText: { fontSize: 12.5, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  body: { fontSize: 15, lineHeight: 26 },
  inlineAuthor: { fontSize: 11, fontWeight: "800", fontFamily: PRETENDARD["800"] },
  openBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    alignSelf: "flex-start",
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  openText: { fontSize: 13.5, fontWeight: "700", fontFamily: PRETENDARD["700"] },

  rollup: { marginTop: 10, paddingTop: 14, borderTopWidth: 1, gap: 14 },
  rollupTitle: { fontSize: 12.5, fontWeight: "800", fontFamily: PRETENDARD["800"], letterSpacing: 0.2, marginBottom: 2 },
  rollupRow: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: 10,
    overflow: "hidden",
  },
  rollupBar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  rollupWhoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  rollupWho: { fontSize: 14, fontWeight: "800", fontFamily: PRETENDARD["800"] },
  rollupDot: { width: 11, height: 11, borderRadius: 6 },
  rollupQuote: { fontSize: 12.5, lineHeight: 18, marginTop: 4 },
  rollupNote: { fontSize: 13.5, lineHeight: 19, marginTop: 5 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 34,
    gap: 12,
  },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 16, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  sheetLabel: { fontSize: 12, fontWeight: "700", fontFamily: PRETENDARD["700"], marginTop: 2 },
  quote: {
    fontSize: 14.5,
    lineHeight: 22,
    borderRadius: 8,
    padding: 10,
    overflow: "hidden",
  },
  otherLabel: { fontSize: 12, fontWeight: "800", fontFamily: PRETENDARD["800"], marginTop: 2, marginBottom: 8 },
  other: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 10,
    borderRadius: 10,
    overflow: "hidden",
    marginBottom: 8,
  },
  otherBar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  otherName: { fontSize: 13.5, fontWeight: "800", fontFamily: PRETENDARD["800"] },
  otherNote: { fontSize: 13.5, lineHeight: 19, marginTop: 3 },
  hint: { fontSize: 13, lineHeight: 19, paddingVertical: 8 },
  swatches: { flexDirection: "row", gap: 10, marginTop: 2 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  noteInput: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    minHeight: 60,
    maxHeight: 120,
  },
  actions: { flexDirection: "row", gap: 10, marginTop: 2 },
  delBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    justifyContent: "center",
  },
  saveBtn: { flex: 1, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: PRETENDARD["700"] },
});
