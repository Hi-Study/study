// 문장 하이라이트 색상(형광펜 느낌). 색 위 글자는 항상 어두운색으로(다크모드 가독).
export interface HighlightColor {
  key: string;
  label: string;
  bg: string;
}

export const HIGHLIGHT_COLORS: HighlightColor[] = [
  { key: "yellow", label: "노랑", bg: "#ffe58a" },
  { key: "green", label: "초록", bg: "#bdeeb4" },
  { key: "pink", label: "분홍", bg: "#ffc2d6" },
  { key: "blue", label: "파랑", bg: "#bcdcff" },
  { key: "purple", label: "보라", bg: "#e2cdf6" },
];

/** 하이라이트 위 글자색(형광펜 배경에서 잘 보이게 고정). */
export const HIGHLIGHT_TEXT = "#241a26";

export function highlightBg(key: string | undefined | null): string {
  return HIGHLIGHT_COLORS.find((c) => c.key === key)?.bg ?? HIGHLIGHT_COLORS[0].bg;
}
