/**
 * 색상 토큰 — distill 디자인 가이드(DESIGN_GUIDE.md §2) 정본값.
 * 강조색은 인디고(#4F46E5). 기존 토큰 이름은 유지하고 distill 값으로 매핑 + distill 신규 토큰 추가.
 */

export const lightColors = {
  // Brand / Action (인디고)
  primary: "#4F46E5",
  primaryFocus: "#6366F1",
  primaryPress: "#4338CA",
  primaryOnDark: "#C7C9F9",
  primaryTint: "#EEF0FE", // 선택 칩 배경·강조 옅은 배경
  action: "#4F46E5",
  actionOn: "#ffffff",
  focusRing: "#6366F1",

  // Ink / Text
  textPrimary: "#111827",
  textSecondary: "#4B5563",
  textMuted: "#9CA3AF",
  textLink: "#4F46E5",

  // Surfaces
  surfacePage: "#F9FAFB",
  surfacePageAlt: "#EEF0FE",
  surfaceCard: "#FFFFFF",
  surfaceNav: "#FFFFFF",
  surfaceSunken: "#F3F4F6", // 검색바·입력·옅은 블록
  canvasParchment: "#F3F4F6",
  pearl: "#F3F4F6",
  tintLavender: "#EEF0FE",
  accentTint: "#EEF0FE",

  // Hairlines / Borders
  hairline: "#EAECEF",
  dividerSoft: "#F3F4F6",
  borderCard: "#EAECEF",
  accentTintBorder: "rgba(79,70,229,0.20)",

  // Semantic (인디고와 어울리게 채도 낮춤)
  error: "#D65C5C",
  danger: "#D65C5C",
  success: "#3C9E79",
  warning: "#C4913C",
  info: "#5468D6",
  hot: "#DE6A4E",
  hotTint: "#FBEDE8",

  // Tabbar
  tabbarBg: "rgba(255,255,255,0.96)",
} as const;

export const darkColors = {
  primary: "#7C83FF",
  primaryFocus: "#9096FF",
  primaryPress: "#6970E6",
  primaryOnDark: "#0F1115",
  primaryTint: "#232445",
  action: "#7C83FF",
  actionOn: "#0F1115",
  focusRing: "#9096FF",

  textPrimary: "#F3F4F6",
  textSecondary: "#C2C7D0",
  textMuted: "#7C8494",
  textLink: "#9096FF",

  surfacePage: "#0F1115",
  surfacePageAlt: "#171A21",
  surfaceCard: "#171A21",
  surfaceNav: "#171A21",
  surfaceSunken: "#1F232C",
  canvasParchment: "#1F232C",
  pearl: "#1F232C",
  tintLavender: "#232445",
  accentTint: "#232445",

  hairline: "#2A2F3A",
  dividerSoft: "#1F232C",
  borderCard: "#2A2F3A",
  accentTintBorder: "rgba(124,131,255,0.35)",

  error: "#E06B6B",
  danger: "#E06B6B",
  success: "#4FB08C",
  warning: "#D2A34F",
  info: "#6E80E0",
  hot: "#E67E64",
  hotTint: "#3A241E",

  tabbarBg: "rgba(23,26,33,0.94)",
} as const;

export type ColorTokens = typeof lightColors;
