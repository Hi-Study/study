import { useState } from "react";
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from "react-native";
import { Link2 } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { domainOf, stripArticleNoise } from "@/lib/text";
import { HighlightSection } from "./HighlightSection";

// 진입 시 AI 요약도 함께 보이도록 접힘 미리보기는 짧게(약 200자)만 노출.
const PREVIEW_CHARS = 200;

/**
 * 링크 원문 카드 — 도메인(클릭 시 이동) + 본문 일부 + [원문 전체보기] + [원문 이동]. 보라색 좌측 라인.
 * highlight 를 주면(공유 글) 원문을 펼쳤을 때 그 본문에서 바로 문장을 눌러 밑줄+감상을 남길 수 있다.
 */
export function LinkArticle({
  url,
  articleText,
  ogDescription,
  loading,
  highlight,
}: {
  url: string;
  articleText: string | null;
  ogDescription: string | null;
  loading: boolean;
  highlight?: { shareId: string; studyId: string };
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [expanded, setExpanded] = useState(false);

  const full = stripArticleNoise(articleText ?? "");
  const isLong = full.length > PREVIEW_CHARS;
  const showingFull = expanded || !isLong;
  const shownText = showingFull ? full : full.slice(0, PREVIEW_CHARS).trim() + "…";
  const shownParas = shownText.split("\n").map((p) => p.trim()).filter(Boolean);

  return (
    <View style={[styles.card, { borderLeftColor: c.primary }]}>
      {/* 도메인 — 누르면 원본 URL 로 이동 */}
      <Pressable onPress={() => Linking.openURL(url)} style={styles.domainRow} hitSlop={6}>
        <Link2 size={13} color={c.textLink} />
        <Text style={[styles.domain, { color: c.textLink }]} numberOfLines={1}>
          {domainOf(url)}
        </Text>
      </Pressable>

      {full.length > 0 ? (
        highlight && showingFull ? (
          // 펼친 원문 = 밑줄 대상(문장 눌러 감상). 원문을 두 번 보여주지 않는다.
          <HighlightSection
            shareId={highlight.shareId}
            studyId={highlight.studyId}
            text={full}
          />
        ) : (
          <>
            {shownParas.map((p, i) => (
              <Text key={i} style={[styles.body, { color: c.textPrimary }]}>
                {p}
              </Text>
            ))}
            {isLong && !expanded ? (
              <Pressable onPress={() => setExpanded(true)} style={styles.expand} hitSlop={6}>
                <Text style={[styles.expandText, { color: c.textLink }]}>
                  {highlight ? "원문 펼치고 밑줄 긋기 ▾" : "원문 전체보기 ▾"}
                </Text>
              </Pressable>
            ) : null}
          </>
        )
      ) : loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="small" color={c.primary} />
          <Text style={[styles.desc, { color: c.textMuted }]}>원문 본문 불러오는 중…</Text>
        </View>
      ) : (
        <Text style={[styles.desc, { color: c.textSecondary }]}>
          {ogDescription || "원문 본문을 불러오지 못했어요. 아래 버튼으로 원문을 확인하세요."}
        </Text>
      )}

      {/* 원문 이동 — 항상 하단 */}
      <Pressable onPress={() => Linking.openURL(url)} style={[styles.btn, { backgroundColor: c.primary }]}>
        <Text style={styles.btnText}>원문 이동 ↗</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: 10, paddingLeft: 12, borderLeftWidth: 4 },
  domainRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  domain: { fontSize: 12.5, fontWeight: "600", flex: 1 },
  desc: { flex: 1, fontSize: 13.5, lineHeight: 20, marginTop: 6 },
  body: { fontSize: 14.5, lineHeight: 23, marginTop: 8 },
  loading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  expand: { marginTop: 8, alignSelf: "flex-start" },
  expandText: { fontSize: 13, fontWeight: "700" },
  btn: { alignSelf: "flex-start", marginTop: 10, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 90 },
  btnText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
});
