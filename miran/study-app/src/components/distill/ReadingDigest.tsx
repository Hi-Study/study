/**
 * 읽기 요약 — 글을 **1분 안에 파악**하게 만드는 본체.
 *
 *   ① 알아두면 편해요  — 이 글에서 막힐 개발 용어 (읽기 전에)
 *   ② 한눈에           — 무슨 일 / 왜 했나 / 그래서 뭐가 달라졌나
 *   ③ 기획 포인트      — 기획자가 이 글을 어떤 눈으로 볼 것인가 (없으면 숨김)
 *   ④ 더 들어가 볼까요 — 칸마다 **질문 → 문제 → 해결 → 그래서 어떻게 됐나 → 원문**
 *
 * **시간순 한 줄 나열을 버렸다.** 실제로 나온 줄이 "원천 데이터에 메타데이터를 붙여
 * 임베딩을 만든다" 같은 것이었다 — 개발자가 한 일의 순서일 뿐, 읽는 사람이 궁금한 게 아니다.
 * 읽는 사람이 묻는 건 늘 셋이다: 무슨 일이야, 왜 했대, 그래서 뭐가 달라졌어.
 *
 * ③ 의 소제목은 반드시 ② 에서 **이미 나온 이야기를 파고드는 질문**이다.
 * 예전엔 "컨텍스트 엔지니어링" 같은 새 개념이 갑자기 소제목으로 올라와, 원문을 안 본
 * 사람은 거기서 길을 잃었다.
 *
 * 칸마다 **근거가 된 원문 덩어리를 접어둔다**(`block`). 누르면 그 자리에서 원문이 그대로
 * 펼쳐진다 — 요약을 믿을지 말지를 화면을 떠나지 않고 확인할 수 있어야 한다.
 *
 * 용어는 **자동으로 밑줄**이 그어진다. 예전에는 문장을 길게 눌러 그 안의 단어를 직접
 * 고르게 했는데, 그건 **어떤 단어가 어려운지 아는 사람만** 쓸 수 있는 방식이었다.
 */
import { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { ArrowRight, BookOpen, ChevronDown, ChevronUp, Compass, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype, reading } from "@/theme";
import { hasPlannerPoint, hasSections, hasTerms, leadRows, splitByTerms } from "@/lib/guide";
import { cleanBody, groupSentencesIntoBlocks, splitSentences } from "@/lib/text";
import type { ReadingGuide } from "@/types/database";

export function ReadingDigest({
  guide,
  body,
  fontScale = 1,
}: {
  guide: ReadingGuide;
  /** 원문 본문 — 칸을 눌렀을 때 보여줄 근거 덩어리를 여기서 꺼낸다. */
  body?: string | null;
  /** 글자 크기 토글(가/가). 요약이 본문 역할을 하므로 여기에도 먹어야 한다. */
  fontScale?: number;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [openTerm, setOpenTerm] = useState<string | null>(null);
  /**
   * 펼쳐둔 원문 칸. 하나씩이 아니라 **여러 개를 동시에** 펼 수 있다 —
   * 두 칸을 나란히 놓고 비교하려는 사람이 있다.
   */
  const [openBlocks, setOpenBlocks] = useState<Set<string>>(new Set());
  const toggle = (k: string) =>
    setOpenBlocks((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  // 뜻풀이는 용어 이름으로 찾는다 — 어느 줄에서 눌렀든 같은 뜻이 떠야 한다.
  const termMap = useMemo(() => {
    const m = new Map<string, string>();
    for (const t of guide.terms) m.set(t.term, t.plain);
    return m;
  }, [guide.terms]);
  const knownTerms = useMemo(() => [...termMap.keys()], [termMap]);

  /**
   * 원문 덩어리 — 가이드의 `block` 은 **이 배열의 순번**이다.
   * 엣지 함수(`_shared/blocks.ts`)와 같은 방식으로 나눠야 순번이 맞는다.
   * 한쪽만 고치면 엉뚱한 문단이 펼쳐진다.
   */
  const blockTexts = useMemo(() => {
    const clean = cleanBody(body ?? "");
    if (!clean) return [];
    return groupSentencesIntoBlocks(splitSentences(clean)).map((b) => ({
      kind: b.kind,
      text: b.items
        .map((x) => x.seg)
        .join("")
        .trim(),
    }));
  }, [body]);

  /**
   * 근거로 **보여줄 만한** 덩어리인가.
   * 소제목 블록("ScrollAutoHide")은 펼쳐도 단어 하나뿐이라 확인이 안 된다 — 그건 목차다.
   * 서버 게이트가 이미 거르지만, 예전에 저장된 가이드에는 남아 있다.
   * ⚠️ 길이로만 자르지 않는다 — 20~39자 구간에 멀쩡한 한 문장이 섞여 있다(실측).
   */
  const quoteAt = (i: number): string => {
    const b = blockTexts[i];
    if (!b || b.kind === "heading" || b.text.length < 25) return "";
    return b.text;
  };

  /** 문장 안의 용어에 밑줄 — 누르면 아래 시트에서 뜻이 뜬다. */
  const renderText = (text: string, style: object, extraTerms: string[] = []) => {
    const terms = [...new Set([...knownTerms, ...extraTerms])].filter((t) => termMap.has(t));
    const parts = splitByTerms(text, terms);
    return (
      <Text style={style}>
        {parts.map((p, i) =>
          p.term ? (
            <Text
              key={i}
              onPress={() => setOpenTerm(p.term)}
              style={{
                color: c.primary,
                textDecorationLine: "underline",
                textDecorationColor: c.accentTintBorder,
              }}
            >
              {p.text}
            </Text>
          ) : (
            <Text key={i}>{p.text}</Text>
          ),
        )}
      </Text>
    );
  };

  /**
   * 원문 펼치기 — 이 칸의 근거 **전부**를 펼친다.
   * 근거가 둘 이상이면 몇 군데인지 버튼에 적는다("원문에서 확인 (3군데)") —
   * 답은 글 곳곳에서 모아 쓴 것인데 문단 하나만 뜨면 근거가 빈약해 보인다.
   */
  const renderQuote = (k: string, blocks: number[]) => {
    const quotes = blocks.map(quoteAt).filter(Boolean);
    // 눌렀는데 아무 일도 안 일어나면 다음부터는 아무도 안 누른다.
    if (quotes.length === 0) return null;
    const open = openBlocks.has(k);
    return (
      <>
        <Pressable style={styles.moreBtn} hitSlop={6} onPress={() => toggle(k)}>
          <Text style={[styles.moreText, { color: c.primary }]}>
            {open ? "원문 접기" : `원문에서 확인${quotes.length > 1 ? ` (${quotes.length}군데)` : ""}`}
          </Text>
          {open ? (
            <ChevronUp size={13} color={c.primary} strokeWidth={2.4} />
          ) : (
            <ChevronDown size={13} color={c.primary} strokeWidth={2.4} />
          )}
        </Pressable>
        {open
          ? quotes.map((q, i) => <Quote key={i} text={q} fontScale={fontScale} />)
          : null}
      </>
    );
  };

  /**
   * 글자 크기(가/가) 적용 — **정의된 값만** 곱한다.
   * 예전처럼 `styles.x.fontSize * fontScale` 을 그대로 쓰면, 그 스타일에 fontSize 가 없을 때
   * `NaN` 이 되고 RN 은 그 값을 조용히 버린다 → 눌러도 아무 변화가 없다.
   */
  const scaled = <T extends { fontSize?: number; lineHeight?: number }>(base: T) => ({
    ...base,
    ...(typeof base.fontSize === "number" ? { fontSize: base.fontSize * fontScale } : null),
    ...(typeof base.lineHeight === "number" ? { lineHeight: base.lineHeight * fontScale } : null),
  });

  const leadStyle = { ...scaled(styles.leadAnswer), color: c.textPrimary };
  const paraStyle = { ...scaled(styles.para), color: c.textSecondary };
  // 질문·용어도 같이 커진다 — 답만 커지면 짝이 안 맞아 "안 먹는다"고 느껴진다.
  const leadQStyle = { ...scaled(styles.leadQ), color: c.primary };
  const termNameStyle = { ...scaled(styles.termName), color: c.textPrimary };
  const termPlainStyle = { ...scaled(styles.termPlain), color: c.textSecondary };

  return (
    <View style={styles.wrap}>
      {/* ① 알아두면 편해요 */}
      {hasTerms(guide) ? (
        <View style={[styles.termCard, { backgroundColor: c.primaryTint, borderColor: c.accentTintBorder }]}>
          <View style={styles.termHead}>
            <BookOpen size={15} color={c.primary} strokeWidth={2.2} />
            <Text style={[styles.termHeadText, { color: c.primary }]}>알아두면 편해요</Text>
          </View>
          {guide.terms.map((t) => (
            <View key={t.term} style={styles.termRow}>
              <Text style={termNameStyle}>{t.term}</Text>
              <Text style={termPlainStyle}>{t.plain}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ② 한눈에 — 세 질문. 질문을 **글자로 적어둔다**: 답만 있으면 무엇에 대한 답인지
             읽는 사람이 스스로 맞춰야 하고, 그 순간 다시 어려운 글이 된다. */}
      <View style={styles.block}>
        <View style={styles.blockHead}>
          <Text style={[styles.blockTitle, { color: c.textPrimary }]}>한눈에</Text>
          <View style={[styles.minuteChip, { backgroundColor: c.surfaceSunken }]}>
            <Text style={[styles.minuteText, { color: c.textSecondary }]}>1분 파악</Text>
          </View>
        </View>
        <View style={[styles.leadCard, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
          {leadRows(guide).map((row, i) => (
            <View key={row.q} style={[styles.leadRow, i > 0 && { borderTopWidth: 1, borderTopColor: c.dividerSoft }]}>
              <Text style={leadQStyle}>{row.q}</Text>
              {renderText(row.a, leadStyle)}
            </View>
          ))}
        </View>
      </View>

      {/* ③ 기획 포인트 — "파악했다"와 "내 일에 쓸 수 있다" 사이를 메우는 한 칸.
             원문에 판단·트레이드오프 서술이 없으면 서버가 비워 보내고, 그러면 그리지 않는다.
             억지 교훈을 지어내는 것보다 없는 편이 낫다. */}
      {hasPlannerPoint(guide) ? (
        <View style={[styles.pointCard, { backgroundColor: c.primaryTint, borderColor: c.accentTintBorder }]}>
          <View style={styles.termHead}>
            <Compass size={15} color={c.primary} strokeWidth={2.2} />
            <Text style={[styles.termHeadText, { color: c.primary }]}>기획 포인트</Text>
          </View>
          {renderText(guide.plannerPoint, { ...scaled(styles.pointText), color: c.textPrimary })}
        </View>
      ) : null}

      {/* ④ 더 들어가 볼까요 — 질문형 소제목. 없으면 통째로 숨긴다(짧은 글은 없는 게 정상) */}
      {hasSections(guide) ? (
        <View style={styles.block}>
          <Text style={[styles.blockTitle, { color: c.textPrimary }]}>더 들어가 볼까요?</Text>
          {guide.sections.map((s, i) => (
            <View
              key={i}
              style={[styles.sectionCard, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
            >
              <Text style={[styles.sectionQ, { color: c.textPrimary }]}>{s.question}</Text>
              {/* 문제를 **따로 세운다** — 해결과 같은 불릿에 섞으면 어디까지가 문제인지 안 보인다.
                  순서를 프롬프트에 맡기지 않고 필드를 나눠 구조로 못 박았다(§4.10). */}
              {s.problem ? (
                <View style={[styles.problemBox, { backgroundColor: c.surfaceSunken }]}>
                  {renderText(
                    s.problem,
                    { ...scaled(styles.problemText), color: c.textSecondary },
                    s.terms,
                  )}
                </View>
              ) : null}
              {s.paras.map((para, j) => (
                <View key={j} style={styles.bulletRow}>
                  {/* 불릿 없이 문단만 쌓으면 어디서 하나가 끝나고 다음이 시작되는지 안 보인다. */}
                  <View style={[styles.bullet, { backgroundColor: c.textMuted }]} />
                  {renderText(para, paraStyle, s.terms)}
                </View>
              ))}
              {/* 이 칸 하나의 결말 — 문제를 설명만 하고 끝나면 "그래서 이건 어떻게 됐는데"가 남는다.
                  위 soWhat 은 글 전체의 결말이라 칸마다의 답이 되지 못한다. */}
              {s.outcome ? (
                <View style={[styles.outcomeRow, { borderTopColor: c.dividerSoft }]}>
                  <ArrowRight size={13} color={c.primary} strokeWidth={2.4} style={styles.outcomeIcon} />
                  {renderText(
                    s.outcome,
                    { ...scaled(styles.outcomeText), color: c.textPrimary },
                    s.terms,
                  )}
                </View>
              ) : null}
              {renderQuote(`s${i}`, s.blocks)}
            </View>
          ))}
        </View>
      ) : null}

      {/* 용어 뜻 — 바텀시트(DESIGN_SYSTEM §4.5) */}
      <Modal visible={openTerm != null} transparent animationType="slide" onRequestClose={() => setOpenTerm(null)}>
        <Pressable style={styles.backdrop} onPress={() => setOpenTerm(null)} />
        <View style={[styles.sheet, { backgroundColor: c.surfaceCard }]}>
          <View style={[styles.grip, { backgroundColor: c.hairline }]} />
          <View style={styles.sheetHead}>
            <Text style={[styles.sheetTerm, { color: c.textPrimary }]}>{openTerm}</Text>
            <Pressable hitSlop={8} onPress={() => setOpenTerm(null)}>
              <X size={20} color={c.textMuted} />
            </Pressable>
          </View>
          <ScrollView style={styles.sheetBody}>
            <Text style={[styles.sheetPlain, { color: c.textSecondary }]}>
              {openTerm ? (termMap.get(openTerm) ?? "") : ""}
            </Text>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

/**
 * 원문 발췌 — 왼쪽 보라 막대 + 가라앉은 배경.
 * 요약과 **같은 모양으로 그리지 않는다**: 어느 쪽이 글쓴이의 말인지 구별되어야 한다.
 */
function Quote({ text, fontScale }: { text: string; fontScale: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.quote, { backgroundColor: c.surfaceSunken, borderLeftColor: c.accentTintBorder }]}>
      <Text style={[styles.quoteLabel, { color: c.textMuted }]}>원문</Text>
      <Text
        style={[
          styles.quoteText,
          {
            color: c.textSecondary,
            // 정의된 값만 곱한다 — 없으면 NaN 이 되어 크기 조절이 조용히 먹지 않는다.
            ...(typeof styles.quoteText.fontSize === "number"
              ? { fontSize: styles.quoteText.fontSize * fontScale }
              : null),
            ...(typeof styles.quoteText.lineHeight === "number"
              ? { lineHeight: styles.quoteText.lineHeight * fontScale }
              : null),
          },
        ]}
      >
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 22 },

  termCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  termHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  termHeadText: { ...dtype.label, fontSize: 12.5 },
  termRow: { gap: 2 },
  termName: { ...dtype.cardTitle, fontSize: 14.5 },
  termPlain: { ...dtype.bodyS, lineHeight: 21 },

  block: { gap: 10 },
  blockHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  blockTitle: { ...dtype.title },
  minuteChip: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  minuteText: { ...dtype.meta, fontSize: 11 },

  // 한눈에 — 질문 하나에 답 하나. 줄 사이를 옅은 선으로만 나눈다(카드 3개로 쪼개면
  // 셋이 한 덩어리라는 게 안 보인다).
  leadCard: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 16 },
  leadRow: { paddingVertical: 14, gap: 6 },
  leadQ: { ...dtype.label, fontSize: 12.5 },
  leadAnswer: { ...dtype.body, fontSize: 15.5, lineHeight: 26 },

  // 기획 포인트 — 용어 카드와 같은 강조 톤(primaryTint). 둘 다 '읽기를 돕는 층'이라 짝이 맞는다.
  pointCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 8 },
  pointText: { ...dtype.body, fontSize: 15, lineHeight: 25 },
  sectionCard: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 10 },
  sectionQ: { ...dtype.cardTitle, fontSize: 16, lineHeight: 24 },
  para: { ...dtype.bodyS, fontSize: 14.5, lineHeight: 24, flex: 1 },
  // 문제는 가라앉은 배경으로 한 덩어리 — 아래 해결 불릿과 시각적으로 갈라 놓는다.
  problemBox: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  problemText: { ...dtype.bodyS, fontSize: 14.5, lineHeight: 23 },
  bulletRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bullet: { width: 4, height: 4, borderRadius: 2, marginTop: 10 },
  // 결말은 설명과 **선으로 갈라 놓는다** — 같은 모양이면 문단 하나가 더 붙은 걸로 읽힌다.
  outcomeRow: { flexDirection: "row", gap: 6, borderTopWidth: 1, paddingTop: 10, marginTop: 2 },
  outcomeIcon: { marginTop: 5 },
  outcomeText: { ...dtype.body, fontSize: 14.5, lineHeight: 23, flex: 1 },

  // 원문 펼치기 — 글자만. 버튼 모양을 주면 칸마다 버튼이 쌓여 목록이 어수선해진다.
  moreBtn: { flexDirection: "row", alignItems: "center", gap: 3, alignSelf: "flex-start" },
  moreText: { ...dtype.label, fontSize: 12 },
  quote: { borderLeftWidth: 3, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, gap: 4 },
  // 인용이 여러 개면 서로 붙지 않게 — 한 덩어리로 보이면 어디까지가 한 문단인지 모른다.
  quoteGap: { height: 6 },
  quoteLabel: { ...dtype.meta, fontSize: 10.5, lineHeight: 15 },
  quoteText: { ...reading.para, fontSize: 15, lineHeight: 25 },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: "72%",
  },
  grip: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 12 },
  sheetHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  sheetTerm: { ...dtype.titleL, fontSize: 20 },
  sheetBody: { marginTop: 10 },
  sheetPlain: { ...dtype.body, lineHeight: 25 },
});
