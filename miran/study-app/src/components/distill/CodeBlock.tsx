// 본문 코드 블록 — 등폭 글꼴 + 어두운 배경 + 가로 스크롤.
//
// 왜 필요한가: 예전엔 코드가 평문으로 산문 사이에 섞여 들어갔다. 들여쓰기도 날아가서
// 어디부터 어디까지가 코드인지 알 수 없었다(실측: 카카오페이 Kotlin 예제).
// 추출기가 [[code:…]] 마커로 남겨주면 여기서 코드답게 그린다.
//
// 줄바꿈을 살려야 하므로 **가로로 줄바꿈하지 않고 스크롤**한다. 코드를 강제로 접으면
// 들여쓰기가 무너져서 오히려 못 읽는다.
import React from "react";
import { Platform, ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";

const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" });

export function CodeBlock({ code, fontScale = 1 }: { code: string; fontScale?: number }) {
  const { theme } = useTheme();
  const dark = theme.mode === "dark";
  // 코드는 **라이트 모드에서도 어두운 면**으로 둔다 — 산문과 확실히 구분되고,
  // 들여쓰기·기호가 흰 바탕보다 훨씬 잘 읽힌다(GitHub·Notion 과 같은 관습).
  // 그래서 이 4개는 토큰이 아니라 상수다. DESIGN_SYSTEM §6 이 허용하는 "극소수 예외".
  const bg = dark ? "#12161C" : "#1E232B";
  const fg = dark ? "#D7DEE9" : "#E6EDF3";

  return (
    <View style={[styles.wrap, { backgroundColor: bg }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator
        contentContainerStyle={styles.inner}
        // 코드 안에서 가로로 끌 때 세로 스크롤이 같이 먹지 않게.
        directionalLockEnabled
      >
        <Text
          style={[
            styles.code,
            { color: fg, fontSize: 13 * fontScale, lineHeight: 20 * fontScale },
          ]}
        >
          {code}
        </Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { borderRadius: 10, overflow: "hidden" },
  inner: { paddingHorizontal: 14, paddingVertical: 12 },
  code: { fontFamily: MONO },
});
