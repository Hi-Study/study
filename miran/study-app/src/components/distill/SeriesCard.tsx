/**
 * 시리즈 카드 — **여러 편으로 나뉜 이야기를 한 줄로 잇는다**(스키마 §40).
 *
 * 왜 필요한가: 시리즈 중간편은 그 편만 열면 무슨 이야기인지 알 수 없다.
 * "왜 만들었나"는 1편에만 있고 중간편은 구현만 다루는 일이 흔해서,
 * 중간편만 보면 "그래서 이걸 왜 읽어야 하지"가 안 잡힌다.
 *
 * 그래서 **빼지 않고 여기서 잇는다.** 지금 읽는 편이 몇 번째인지, 앞뒤에 무엇이 있는지 보여준다.
 *
 * ⚠️ 지금 편은 **누를 수 없게** 둔다. 같은 화면으로 가는 버튼은 눌러도 아무 일이 없어서,
 *    누른 사람은 "고장났나?"라고 읽는다.
 *
 * ⚠️ 줄에 쓰는 제목은 **원문 제목(title)** 이다. 목록·상세는 기획자용 제목을 쓰지만
 *    (ArticleCards.CardTitle) 시리즈만은 예외다 — 기획자용 제목은 "(1)", "2편" 같은 회차
 *    표시를 떼고 다시 쓴 문장이라, 여기 쓰면 몇 편인지 읽히지 않고 편들이 서로 남남처럼 보인다.
 *    회차를 잇는 자리에서는 원문이 정본이다.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Check, Layers } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype } from "@/theme";
import type { ArticleWithBlog } from "@/data/articles";

export function SeriesCard({
  items,
  currentId,
  onSelect,
}: {
  /** 같은 시리즈의 글(회차 순). 2편 미만이면 아무것도 그리지 않는다. */
  items: ArticleWithBlog[];
  currentId: string;
  onSelect: (articleId: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;

  if (items.length < 2) return null;
  const here = items.findIndex((a) => a.id === currentId);

  return (
    <View style={[styles.card, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
      <View style={styles.head}>
        <Layers size={15} color={c.primary} />
        <Text style={[styles.title, { color: c.textPrimary }]}>이어지는 이야기예요</Text>
        <View style={{ flex: 1 }} />
        {/* 몇 번째인지 — "3편 중 2편". 숫자가 없으면 얼마나 남았는지 가늠이 안 된다. */}
        {here >= 0 ? (
          <Text style={[styles.count, { color: c.textMuted }]}>
            {items.length}편 중 {here + 1}편
          </Text>
        ) : null}
      </View>

      <View style={styles.list}>
        {items.map((a, i) => {
          const isHere = a.id === currentId;
          return (
            <Pressable
              key={a.id}
              disabled={isHere}
              onPress={() => onSelect(a.id)}
              style={[
                styles.row,
                { borderColor: isHere ? c.primary : c.hairline },
                isHere && { backgroundColor: c.primaryTint },
              ]}
            >
              {/* 회차 뱃지 — 원 안에 숫자. 지금 편은 채워서 어디 있는지 한눈에 보이게. */}
              <View
                style={[
                  styles.no,
                  { borderColor: isHere ? c.primary : c.hairline },
                  isHere && { backgroundColor: c.primary },
                ]}
              >
                <Text style={[styles.noText, { color: isHere ? c.actionOn : c.textSecondary }]}>
                  {a.series_no ?? i + 1}
                </Text>
              </View>
              <Text
                style={[styles.rowTitle, { color: isHere ? c.textPrimary : c.textSecondary }]}
                numberOfLines={2}
              >
                {a.title}
              </Text>
              {isHere ? <Check size={15} color={c.primary} /> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, padding: 16, gap: 12 },
  head: { flexDirection: "row", alignItems: "center", gap: 6 },
  title: { ...dtype.cardTitle },
  count: { ...dtype.meta },
  list: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  no: {
    width: 22,
    height: 22,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  noText: { ...dtype.label, fontSize: 11 },
  // 제목은 두 줄까지 — 한 줄로 자르면 편마다 부제가 달라서 무엇인지 구분이 안 된다.
  rowTitle: { ...dtype.body, fontSize: 14, lineHeight: 20, flex: 1 },
});
