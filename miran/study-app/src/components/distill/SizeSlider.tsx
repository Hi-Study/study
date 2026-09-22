/**
 * 카드 크기 슬라이더 — 목록을 리스트/그리드/큰 카드로 바꾼다.
 *
 * 단계가 3개뿐이라 연속 슬라이더가 아니라 **눈금 3칸**으로 만들었다.
 * 손을 떼는 위치에 따라 결과가 달라지면(연속) 같은 화면을 두 번 만들 수 없다 —
 * 사용자가 "아까 그 크기"로 돌아오지 못한다.
 * 탭(눈금 누르기)과 드래그를 둘 다 받는다. 드래그만 되면 눈금이 작아 누르기 어렵다.
 */
import { useRef, useState } from "react";
import { PanResponder, Pressable, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype } from "@/theme";

export type CardSize = 0 | 1 | 2; // 0=리스트, 1=2열 그리드, 2=큰 카드

const LABELS = ["리스트", "그리드", "큰 카드"];

export function SizeSlider({
  value,
  onChange,
  hint,
}: {
  value: CardSize;
  onChange: (v: CardSize) => void;
  /** 처음 한 번만 띄우는 안내 말풍선(없으면 안 띄운다). */
  hint?: string | null;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const valueRef = useRef<CardSize>(value);
  valueRef.current = value;

  // 좌표 → 눈금. 폭을 ref 로도 들고 있는 이유: PanResponder 콜백은 생성 시점의 state 를 붙든다.
  const toStep = (x: number): CardSize => {
    const w = widthRef.current;
    if (w <= 0) return valueRef.current;
    const ratio = Math.max(0, Math.min(1, x / w));
    return Math.round(ratio * 2) as CardSize;
  };

  // onChange 가 매 렌더 새 함수여도 PanResponder 를 다시 만들지 않도록 ref 로 넘긴다.
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (e) => {
        const next = toStep(e.nativeEvent.locationX);
        if (next !== valueRef.current) onChangeRef.current(next);
      },
      onPanResponderGrant: (e) => {
        const next = toStep(e.nativeEvent.locationX);
        if (next !== valueRef.current) onChangeRef.current(next);
      },
    }),
  ).current;

  return (
    <View style={styles.wrap}>
      {hint ? (
        <View style={[styles.hint, { backgroundColor: c.primary }]}>
          <Text style={[styles.hintText, { color: c.actionOn }]}>{hint}</Text>
        </View>
      ) : null}
      <View
        style={styles.track}
        onLayout={(e) => {
          widthRef.current = e.nativeEvent.layout.width;
          setWidth(e.nativeEvent.layout.width);
        }}
        {...pan.panHandlers}
      >
        <View style={[styles.rail, { backgroundColor: c.surfaceSunken }]} />
        <View
          style={[
            styles.railFill,
            { backgroundColor: c.primary, width: width > 0 ? (width * value) / 2 : 0 },
          ]}
        />
        {[0, 1, 2].map((i) => (
          <Pressable
            key={i}
            style={[styles.notchHit, { left: width > 0 ? (width * i) / 2 - 18 : 0 }]}
            onPress={() => onChange(i as CardSize)}
            hitSlop={8}
          >
            <View
              style={[
                i === value ? styles.knob : styles.notch,
                {
                  backgroundColor: i <= value ? c.primary : c.surfaceSunken,
                  borderColor: c.surfaceCard,
                },
              ]}
            />
          </Pressable>
        ))}
      </View>
      <Text style={[styles.label, { color: c.textMuted }]}>{LABELS[value]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 4 },
  track: { height: 28, justifyContent: "center" },
  rail: { height: 4, borderRadius: 2 },
  railFill: { position: "absolute", height: 4, borderRadius: 2 },
  notchHit: { position: "absolute", width: 36, height: 28, alignItems: "center", justifyContent: "center" },
  notch: { width: 10, height: 10, borderRadius: 5 },
  knob: { width: 18, height: 18, borderRadius: 9, borderWidth: 3 },
  label: { ...dtype.meta, alignSelf: "flex-end" },
  hint: { alignSelf: "flex-start", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, marginBottom: 2 },
  hintText: { ...dtype.meta, fontSize: 11.5 },
});
