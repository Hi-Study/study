/**
 * 내 취향 분포 막대 — **무엇을**(대분류) · **어디 글을**(기업) 읽는 사람인가.
 *
 * 두 축인 이유: 대분류만 보면 "AI 활용을 많이 읽네"에서 멈춘다. 같은 주제라도 어느 회사
 * 글을 골라 읽는지가 취향의 나머지 반이다(같은 A/B 테스트 글이라도 토스와 당근은 다르다).
 *
 * 막대는 **비율(share)로 길이를 정하고 숫자는 편수로 적는다.** 비율만 쓰면 3편 중 2편이
 * 67%로 그려져 과장되고, 편수만 쓰면 서로 비교가 안 된다.
 *
 * 분모가 축마다 다르다 — 대분류는 *분류된 글*, 기업은 *읽은 글 전체*(lib/taste.ts).
 * 그래서 두 축의 숫자를 더해 맞춰 보려 하지 않아도 되게, 축마다 분모를 적어 둔다.
 */
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype, PRETENDARD } from "@/theme";

export interface TasteBarRow {
  label: string;
  count: number;
  share: number;
}

/** 한 축에 그리는 막대 수 — 넷을 넘으면 "분포"가 아니라 목록이 된다. */
const MAX_ROWS = 4;

export function TasteBars({
  categories,
  blogs,
  categoryTotal,
  blogTotal,
}: {
  categories: TasteBarRow[];
  blogs: TasteBarRow[];
  categoryTotal: number;
  blogTotal: number;
}) {
  const groups = [
    { key: "cat", title: "주제", rows: categories.slice(0, MAX_ROWS), total: categoryTotal },
    { key: "blog", title: "기업", rows: blogs.slice(0, MAX_ROWS), total: blogTotal },
  ].filter((g) => g.rows.length > 0);

  if (groups.length === 0) return null;

  return (
    <View style={styles.wrap}>
      {groups.map((g) => (
        <Group key={g.key} title={g.title} rows={g.rows} total={g.total} />
      ))}
    </View>
  );
}

function Group({ title, rows, total }: { title: string; rows: TasteBarRow[]; total: number }) {
  const { theme } = useTheme();
  const c = theme.colors;
  // 1등을 꽉 찬 막대로 두고 나머지를 그에 견준다 — 5%짜리 막대 넷은 아무것도 안 보인다.
  const top = Math.max(...rows.map((r) => r.share), 0.0001);

  return (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <Text style={[styles.groupTitle, { color: c.textSecondary }]}>{title}</Text>
        <Text style={[styles.groupTotal, { color: c.textMuted }]}>{total}편 기준</Text>
      </View>
      {rows.map((r) => (
        <View key={r.label} style={styles.row}>
          <Text style={[styles.label, { color: c.textPrimary }]} numberOfLines={1}>
            {r.label}
          </Text>
          <View style={[styles.track, { backgroundColor: c.surfaceSunken }]}>
            <View
              style={[
                styles.fill,
                { backgroundColor: c.primary, width: `${Math.max((r.share / top) * 100, 6)}%` },
              ]}
            />
          </View>
          <Text style={[styles.count, { color: c.textMuted }]}>{r.count}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  group: { gap: 6 },
  groupHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  groupTitle: { ...dtype.label, fontSize: 12, letterSpacing: 0.2 },
  groupTotal: { ...dtype.meta },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  // 라벨 폭을 고정한다 — 글자 수에 따라 막대 시작점이 들쭉날쭉하면 비교가 안 된다.
  label: { ...dtype.bodyS, width: 104 },
  track: { flex: 1, height: 8, borderRadius: 999, overflow: "hidden" },
  fill: { height: "100%", borderRadius: 999 },
  count: { ...dtype.meta, width: 20, textAlign: "right", fontFamily: PRETENDARD["600"] },
});
