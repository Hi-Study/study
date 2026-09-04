// distill 원문 문장 하이라이트 — 문장을 눌러 밑줄+메모(나만 보기, 비공개). article_highlights 기반.
import { useEffect, useMemo, useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Highlighter, Lock, Trash2, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useUid } from "@/auth/AuthProvider";
import {
  useArticleHighlights,
  useUpsertArticleHighlight,
  useDeleteArticleHighlight,
  type ArticleHighlightRow,
} from "@/data";
import {
  splitSentences,
  groupSentencesIntoBlocks,
  imageMarkerUrl,
  codeMarkerText,
} from "@/lib/text";
import { CodeBlock } from "./CodeBlock";
import { safeImageUri } from "@/lib/image";
import { reading , PRETENDARD} from "@/theme";
import { HIGHLIGHT_COLORS, HIGHLIGHT_TEXT, highlightBg } from "@/lib/highlight";
import { WordPickerSheet } from "@/components/distill/WordPickerSheet";

export function ArticleHighlightSection({
  articleId,
  text,
  fontScale = 1,
}: {
  articleId: string;
  text: string;
  fontScale?: number;
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
  const activeHl = active ? list.find((h) => h.sentence_index === active.index) : undefined;

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Highlighter size={14} color={c.primary} />
        <Text style={[styles.headText, { color: c.primary }]}>
          눌러서 밑줄·메모(나만 보기) · 길게 눌러 단어 저장
        </Text>
      </View>

      <HighlightableText
        text={text}
        highlights={list}
        activeIndex={active?.index ?? null}
        fontScale={fontScale}
        onTap={(index, quote) => setActive({ index, quote })}
        onLongPress={(quote) => setWordSentence(quote)}
      />

      {list.length > 0 ? (
        <View style={[styles.rollup, { borderTopColor: c.hairline }]}>
          <View style={styles.rollupHead}>
            <Lock size={12} color={c.textMuted} />
            <Text style={[styles.rollupTitle, { color: c.textSecondary }]}>
              내 밑줄 & 메모 {list.length}
            </Text>
          </View>
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
                <View style={{ flex: 1 }}>
                  {h.quote ? (
                    <Text numberOfLines={1} style={[styles.rollupQuote, { color: c.textPrimary }]}>
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
                  mine={activeHl}
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
  activeIndex,
  fontScale,
  onTap,
  onLongPress,
}: {
  text: string;
  highlights: ArticleHighlightRow[];
  activeIndex: number | null;
  fontScale: number;
  onTap: (index: number, quote: string) => void;
  onLongPress: (quote: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const sentences = useMemo(() => splitSentences(text), [text]);
  const blocks = useMemo(() => groupSentencesIntoBlocks(sentences), [sentences]);
  const byIndex = useMemo(() => {
    const m = new Map<number, ArticleHighlightRow>();
    for (const h of highlights) m.set(h.sentence_index, h);
    return m;
  }, [highlights]);

  // 문장 한 조각 렌더 — 전역 index 로 탭/롱프레스·밑줄 표시(블록으로 묶여도 동일).
  const renderSentence = ({ index: i, seg }: { index: number; seg: string }) => {
    const display = seg.replace(/\n+$/, ""); // 줄 끝 개행은 블록 간격이 대신
    const isActive = i === activeIndex;
    const hl = byIndex.get(i);
    const style = isActive
      ? { backgroundColor: c.primary, color: "#ffffff" }
      : hl
        ? { backgroundColor: highlightBg(hl.color), color: HIGHLIGHT_TEXT }
        : undefined;
    return (
      <Text
        key={i}
        onPress={() => onTap(i, seg.trim())}
        onLongPress={() => onLongPress(seg.trim())}
        style={style}
      >
        {display}
      </Text>
    );
  };

  return (
    <View style={styles.blocks}>
      {blocks.map((b, bi) => {
        // 이미지 마커 줄([[img:URL]])은 텍스트 대신 이미지로 렌더(하이라이트 대상 아님).
        const raw = b.items.map((x) => x.seg).join("");
        const imgUrl = imageMarkerUrl(raw);
        if (imgUrl) return <BodyImage key={bi} url={imgUrl} />;
        // 코드 블록은 하이라이트 대상이 아니다(문장 단위로 밑줄 그을 것이 없다).
        //   ① 수집기가 <pre> 를 마커로 남긴 경우
        //   ② 원문이 <pre> 없이 평문으로 흘려보낸 경우 — 읽기 블록이 코드 냄새로 잡아낸다.
        //      (실측: 당근 실험플랫폼 글의 yaml·SQL 이 줄마다 굵은 소제목이 됐다)
        const code = codeMarkerText(raw);
        if (code) return <CodeBlock key={bi} code={code} fontScale={fontScale} />;
        if (b.kind === "code") {
          return <CodeBlock key={bi} code={raw.replace(/\n+$/, "")} fontScale={fontScale} />;
        }
        // 사용자 폰트 크기 토글(가/가)은 기준값에 곱해서 적용 — 설정과 충돌하지 않는다.
        const base =
          b.kind === "heading" ? reading.heading : b.kind === "list" ? reading.list : reading.para;
        const scaled = {
          fontSize: base.fontSize * fontScale,
          lineHeight: base.lineHeight * fontScale,
          letterSpacing: base.letterSpacing,
        };
        return (
          <Text
            key={bi}
            style={[
              b.kind === "heading" ? styles.blockHeading : styles.blockPara,
              b.kind === "list" && styles.blockList,
              scaled,
              { color: c.textPrimary },
            ]}
          >
            {b.items.map(renderSentence)}
          </Text>
        );
      })}
    </View>
  );
}

// 본문 이미지 — 원본 비율을 측정해 폭 100%로 맞춘다.
function BodyImage({ url }: { url: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [ratio, setRatio] = useState(16 / 9);
  // 못 불러오는 이미지는 **자리를 남기지 않는다**. 회색 빈 박스가 문단 사이에 끼면
  // 글이 끊긴 것처럼 보여서 아예 없는 편이 낫다(핫링크 차단·만료된 CDN 경로 등).
  const [failed, setFailed] = useState(false);
  const uri = safeImageUri(url) ?? url; // 한글 등 비ASCII URL 인코딩
  useEffect(() => {
    let ok = true;
    Image.getSize(
      uri,
      (w, h) => {
        if (ok && w > 0 && h > 0) setRatio(w / h);
      },
      () => undefined,
    );
    return () => {
      ok = false;
    };
  }, [uri]);
  if (failed) return null;
  return (
    <Image
      source={{ uri }}
      style={[styles.bodyImage, { aspectRatio: ratio, backgroundColor: c.surfaceSunken }]}
      resizeMode="cover"
      onError={() => setFailed(true)}
    />
  );
}

function SheetBody({
  quote,
  mine,
  pending,
  onClose,
  onSave,
  onDelete,
}: {
  quote: string;
  mine: ArticleHighlightRow | undefined;
  pending: boolean;
  onClose: () => void;
  onSave: (color: string, note: string | null) => void;
  onDelete: (id: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [color, setColor] = useState<string>(mine?.color ?? "yellow");
  const [note, setNote] = useState<string>(mine?.note ?? "");

  return (
    <View>
      <View style={styles.sheetHead}>
        <Text style={[styles.sheetTitle, { color: c.textPrimary }]}>밑줄 & 메모</Text>
        <Pressable onPress={onClose} hitSlop={8}>
          <X size={20} color={c.textMuted} />
        </Pressable>
      </View>

      <View style={styles.privacyNote}>
        <Lock size={12} color={c.textMuted} />
        <Text style={[styles.privacyText, { color: c.textMuted }]}>나만 볼 수 있어요</Text>
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
        placeholder="메모 (선택)"
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
            <Text style={{ color: c.danger, fontSize: 14, fontWeight: "700", fontFamily: PRETENDARD["700"] }}>삭제</Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { marginTop: 8, gap: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  headText: { fontSize: 12.5, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  // 장문 조판 — 카드용 dtype 과 분리한 reading 토큰을 쓴다(theme/distill.ts).
  blocks: { gap: reading.blockGap },
  blockPara: { ...reading.para },
  blockHeading: { ...reading.heading, fontWeight: "800", fontFamily: PRETENDARD["800"], marginTop: reading.headingTop },
  blockList: { ...reading.list, paddingLeft: reading.listIndent },
  bodyImage: { width: "100%", borderRadius: 10 },

  rollup: { marginTop: 14, paddingTop: 16, borderTopWidth: 1, gap: 12 },
  rollupHead: { flexDirection: "row", alignItems: "center", gap: 5 },
  rollupTitle: { fontSize: 12.5, fontWeight: "800", fontFamily: PRETENDARD["800"], letterSpacing: 0.2 },
  rollupRow: { flexDirection: "row", gap: 10, alignItems: "flex-start", padding: 12, borderRadius: 12, borderWidth: 1, overflow: "hidden" },
  rollupBar: { width: 4, alignSelf: "stretch", borderRadius: 2 },
  rollupQuote: { fontSize: 13.5, lineHeight: 19, fontWeight: "600", fontFamily: PRETENDARD["600"] },
  rollupNote: { fontSize: 13.5, lineHeight: 19, marginTop: 5 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 34, gap: 12 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTitle: { fontSize: 16, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  privacyNote: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: -4 },
  privacyText: { fontSize: 12, fontWeight: "600", fontFamily: PRETENDARD["600"] },
  sheetLabel: { fontSize: 12, fontWeight: "700", fontFamily: PRETENDARD["700"], marginTop: 2 },
  quote: { fontSize: 14.5, lineHeight: 22, borderRadius: 8, padding: 10, overflow: "hidden" },
  swatches: { flexDirection: "row", gap: 10, marginTop: 2 },
  swatch: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, borderColor: "rgba(0,0,0,0.08)" },
  noteInput: { borderWidth: 1, borderRadius: 10, padding: 12, fontSize: 15, minHeight: 60, maxHeight: 120 },
  actions: { flexDirection: "row", gap: 10, marginTop: 2 },
  delBtn: { flexDirection: "row", alignItems: "center", gap: 6, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, justifyContent: "center" },
  saveBtn: { flex: 1, height: 46, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "700", fontFamily: PRETENDARD["700"] },
});
