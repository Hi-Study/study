// 원탭 스탬프 — 글을 다 읽으면 뜨는 버튼 4개. **하나 누르면 끝, 글은 한 글자도 안 쓴다.**
//
// 왜 필요한가: 지금은 글을 끝까지 읽어도 아무 데이터가 안 남는다. 인사이트(6칸 폼)를 쓴
// 소수만 흔적을 남긴다. 스탬프는 "글 못 쓰는 다수"에게서 큐레이션 데이터를 얻는 통로다.
//
// 눌린 스탬프가 뒤에서 하는 일:
//   💡 apply    → 홈 "바로 써먹은 사례" 섹션의 재료
//   🎯 reason   → 결정 카드가 잘 뽑힌 글인지 확인하는 신호
//   🤔 disagree → "같이 읽는 글"에 넣기 좋은 논쟁적인 글
//   😵 hard     → 이 글에 용어 예고가 필요하다는 신호(단어장 연결)
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { STAMP_META, STAMP_ORDER, dtype } from "@/theme";
import { useMyStamps, useStampCounts, useToggleStamp } from "@/data";
import type { StampKind } from "@/types/database";

interface Props {
  articleId: string;
  /** 글을 끝까지 읽었는지 — false 면 안내 문구를 부드럽게 바꾼다. */
  finished?: boolean;
}

export function StampBar({ articleId, finished = true }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const mineQ = useMyStamps(articleId);
  const countsQ = useStampCounts(articleId);
  const toggle = useToggleStamp(articleId);

  const mine = new Set(mineQ.data ?? []);
  const counts = countsQ.data ?? {};

  return (
    <View style={[styles.wrap, { borderColor: c.hairline, backgroundColor: c.surfacePageAlt }]}>
      <Text style={[styles.title, { color: c.textPrimary }]}>
        {finished ? "다 읽으셨네요. 어떠셨어요?" : "읽으면서 느낀 게 있다면"}
      </Text>
      <Text style={[styles.sub, { color: c.textMuted }]}>탭 한 번이면 돼요</Text>

      <View style={styles.grid}>
        {STAMP_ORDER.map((kind: StampKind) => {
          const meta = STAMP_META[kind];
          const on = mine.has(kind);
          const n = counts[kind] ?? 0;
          return (
            <Pressable
              key={kind}
              onPress={() => toggle.mutate({ kind, on: !on })}
              style={[
                styles.stamp,
                {
                  backgroundColor: on ? meta.tint : c.surfaceCard,
                  borderColor: on ? meta.color : c.hairline,
                },
              ]}
            >
              <Text style={styles.emoji}>{meta.emoji}</Text>
              <Text
                style={[styles.label, { color: on ? meta.color : c.textSecondary }]}
                numberOfLines={2}
              >
                {meta.label}
              </Text>
              {n > 0 ? (
                <Text style={[styles.count, { color: on ? meta.color : c.textMuted }]}>{n}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 2 },
  title: { ...dtype.cardTitle },
  sub: { ...dtype.meta, marginBottom: 10 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stamp: {
    flexGrow: 1,
    flexBasis: "45%",
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 9,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  emoji: { fontSize: 15 },
  label: { ...dtype.label, fontSize: 12.5, flex: 1 },
  count: { ...dtype.label, fontSize: 12 },
});
