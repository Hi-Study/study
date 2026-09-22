/**
 * 지금 뜨는 아티클 — 1위부터 10위까지 **한 번에 한 개씩** 돌아가며 보여준다.
 *
 * 왜 캐러셀이 아니라 한 줄인가: 홈 맨 위는 "지금 뭐가 뜨나"만 답하면 된다.
 * 카드 열 개를 깔면 그걸 고르는 일이 또 생기고, 홈이 길어진다.
 * 뉴스 앱의 순위 티커가 이 역할을 오래 해 왔다 — 한 줄이면 스치듯 읽힌다.
 *
 * · 3초마다 다음 순위로 넘어간다. 누르면 그 글로 간다.
 * · 눌러서 멈추지 않는다 — 멈춤 버튼을 두면 이 작은 줄에 버튼이 두 개가 된다.
 *   대신 **한 줄 전체가 링크**라, 읽다가 누르면 그 글이 열린다.
 * · 글이 없으면 **아무것도 그리지 않는다.** "0개" 같은 빈 상태를 띄우지 않는다.
 */
import { useEffect, useRef, useState } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { ChevronRight, Flame } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype, PRETENDARD } from "@/theme";
import { useRootNav } from "@/navigation/types";
import type { ArticleWithBlog } from "@/data/articles";

const ROTATE_MS = 3000;

export function HotTicker({ data }: { data: ArticleWithBlog[] }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const rows = data.slice(0, 10);
  const [i, setI] = useState(0);
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (rows.length < 2) return;
    const timer = setInterval(() => {
      // 글자가 툭 바뀌면 읽던 줄을 놓친다 — 흐리게 뺐다가 다음 줄을 넣는다.
      Animated.timing(fade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setI((prev) => (prev + 1) % rows.length);
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      });
    }, ROTATE_MS);
    return () => clearInterval(timer);
  }, [rows.length, fade]);

  if (rows.length === 0) return null;
  // 목록이 줄어들어 i 가 범위를 벗어나는 순간이 있다(쿼리 갱신). 그때 빈 줄을 그리지 않는다.
  const item = rows[i] ?? rows[0];

  return (
    <View style={[styles.card, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
      <View style={styles.head}>
        <Flame size={13} color={c.primary} strokeWidth={2.4} />
        <Text style={[styles.headText, { color: c.textPrimary }]}>지금 뜨는 아티클</Text>
        {/* "1 / 10" 은 뺐다. 순위 숫자가 바로 옆에 있고 3초마다 바뀌는 게 보이므로
            같은 말을 두 번 하는 셈이었다. */}
      </View>

      <Pressable
        style={styles.row}
        onPress={() => nav.navigate("ArticleDetail", { articleId: item.id })}
      >
        <Text style={[styles.rank, { color: c.primary }]} numberOfLines={1}>
          {i + 1}
        </Text>
        <Animated.Text
          style={[styles.title, { color: c.textPrimary, opacity: fade }]}
          numberOfLines={1}
        >
          {item.title}
        </Animated.Text>
        <ChevronRight size={16} color={c.textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, gap: 6 },
  head: { flexDirection: "row", alignItems: "center", gap: 5 },
  headText: { ...dtype.label, fontSize: 12.5 },
  row: { flexDirection: "row", alignItems: "center", gap: 10 },
  /**
   * 순위 숫자는 폭을 고정한다 — 한 자리에서 두 자리로 넘어갈 때 제목이 덜컥 밀린다.
   * ⚠️ 폭은 **두 자리(10) 기준**이다. 16 으로 잡았더니 "10" 이 두 줄로 쪼개져 세로로 깨졌다.
   */
  rank: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: "800",
    fontFamily: PRETENDARD["800"],
    width: 22,
  },
  title: { ...dtype.cardTitle, fontSize: 14.5, flex: 1 },
});
