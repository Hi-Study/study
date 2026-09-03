// 직군 배지 — "기획자 12명이 이 글을 읽었어요".
//
// 비개발자가 들어와서 개발자만 보이면 그 자리에서 나간다. 반대로 같은 직군이 이미
// 이 글을 읽고 있다는 사실이 보이면 남는다. 그래서 **내 직무를 맨 앞에** 놓는다.
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { JOB_ROLE_META, dtype } from "@/theme";
import { useArticleReaderRoles } from "@/data";
import type { JobRole } from "@/types/database";

interface Props {
  articleId: string;
  /** 내 직무 — 목록 맨 앞으로 끌어올린다. */
  myRole?: JobRole | null;
}

export function ReaderRoles({ articleId, myRole }: Props) {
  const { theme } = useTheme();
  const c = theme.colors;
  const q = useArticleReaderRoles(articleId);

  const rows = (q.data ?? []).filter((r) => r.count > 0 && JOB_ROLE_META[r.jobRole]);
  if (rows.length === 0) return null;

  // 내 직무를 맨 앞으로(있으면). 나머지는 서버가 준 많은 순서 그대로.
  const sorted = myRole
    ? [...rows].sort((a, b) => Number(b.jobRole === myRole) - Number(a.jobRole === myRole))
    : rows;

  return (
    <View style={styles.row}>
      {sorted.slice(0, 2).map((r, idx) => {
        const meta = JOB_ROLE_META[r.jobRole];
        const isMine = r.jobRole === myRole;
        // 문장은 첫 칩에만 — 여러 개에 반복되면 읽기 싫어진다.
        const suffix = idx === 0 ? "명이 읽고 있어요" : "명";
        return (
          <View
            key={r.jobRole}
            style={[
              styles.chip,
              {
                backgroundColor: isMine ? c.primaryTint : c.surfaceSunken,
                borderColor: isMine ? c.accentTintBorder : "transparent",
              },
            ]}
          >
            <Text style={styles.emoji}>{meta.emoji}</Text>
            <Text style={[styles.text, { color: isMine ? c.primary : c.textSecondary }]}>
              {meta.plural} {r.count}{suffix}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  emoji: { fontSize: 12 },
  text: { ...dtype.label, fontSize: 12 },
});
