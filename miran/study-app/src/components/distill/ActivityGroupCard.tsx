// 마이 활동 — **같은 글의 활동을 한 카드로** 묶어 보여준다.
//
// 예전엔 밑줄 5개면 카드 5장, 단어 4개면 카드 4장이 나왔다. 같은 글이 반복되니
// 목록만 길어지고 "내가 어떤 글에서 무엇을 남겼나"가 안 보였다.
// 이제 카드 하나에 글 제목을 두고 그 아래 항목을 모은다.
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype } from "@/theme";

interface Props {
  /** 원본 글/글감 제목. 없으면 대체 문구. */
  title: string | null | undefined;
  /** 출처(기업명) 등 부가 정보 */
  meta?: string | null;
  /** 항목 개수 배지("밑줄 5") */
  countLabel?: string | null;
  onPress?: () => void;
  children: React.ReactNode;
}

export function ActivityGroupCard({ title, meta, countLabel, onPress, children }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;

  return (
    <View style={[styles.card, { borderColor: c.hairline, backgroundColor: c.surfaceCard }]}>
      <Pressable
        style={styles.head}
        onPress={onPress}
        disabled={!onPress}
        hitSlop={4}
      >
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: c.textPrimary }]} numberOfLines={2}>
            {title?.trim() || "(제목 없음)"}
          </Text>
          {meta ? (
            <Text style={[styles.meta, { color: c.textMuted }]} numberOfLines={1}>
              {meta}
            </Text>
          ) : null}
        </View>
        {countLabel ? (
          <View style={[styles.count, { backgroundColor: c.primaryTint }]}>
            <Text style={[styles.countText, { color: c.primary }]}>{countLabel}</Text>
          </View>
        ) : null}
        {onPress ? <ChevronRight size={18} color={c.textMuted} /> : null}
      </Pressable>

      <View style={[styles.body, { borderTopColor: c.hairline }]}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, overflow: "hidden" },
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: { ...dtype.cardTitle, fontSize: 15, lineHeight: 21 },
  meta: { ...dtype.meta, marginTop: 2 },
  count: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3 },
  countText: { ...dtype.label, fontSize: 11.5 },
  body: { borderTopWidth: 1, paddingHorizontal: 14, paddingVertical: 12, gap: 10 },
});
