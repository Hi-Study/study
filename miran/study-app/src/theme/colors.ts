/**
 * 색상 토큰 — distill 디자인 가이드(DESIGN_GUIDE.md §2) 정본값.
 *
 * 강조색은 **바이올렛(#7C3AED)**.
 *   예전 인디고(#4F46E5)는 파랑에 가까워서 카드가 많이 깔린 화면에서 회색 UI 와 섞여 보였다.
 *   바이올렛은 같은 채도에서도 흰 카드 위에서 확실히 떠오르고, 배너·칩·아이콘 타일까지
 *   한 색으로 끌고 갈 수 있어 화면당 강조색 1개 원칙을 지키기 쉽다.
 * ⚠️ 두 객체(light/dark)는 **키 집합이 같아야 한다.** ColorTokens 가 lightColors 로부터
 *    파생되고 darkColors 는 index.ts 에서 캐스팅되므로, 다크에 키가 빠져도 컴파일은 통과하고
 *    런타임에 undefined 가 된다.
 */

export const lightColors = {
  // Brand / Action (바이올렛)
  primary: "#7C3AED",
  primaryFocus: "#8B5CF6",
  primaryPress: "#6D28D9",
  primaryOnDark: "#DDD0FB",
  primaryTint: "#F3EDFF", // 선택 칩 배경·강조 옅은 배경
  primaryDeep: "#5B21B6", // 보라 배너 위 진한 보조(그라데이션 끝)
  action: "#7C3AED",
  actionOn: "#ffffff",
  focusRing: "#8B5CF6",

  // Ink / Text
  textPrimary: "#15121C", // 보라와 맞춘 먹색(순검정 대신 살짝 보랏빛)
  textSecondary: "#4B4658",
  textMuted: "#9A94A8",
  textLink: "#7C3AED",

  // Surfaces
  surfacePage: "#F5F4F8", // 카드가 떠 보이도록 페이지는 한 톤 내린 회보라
  surfacePageAlt: "#F3EDFF",
  surfaceCard: "#FFFFFF",
  surfaceNav: "#FFFFFF",
  surfaceSunken: "#F1F0F5", // 검색바·입력·옅은 블록
  canvasParchment: "#F1F0F5",
  pearl: "#F1F0F5",
  tintLavender: "#F3EDFF",
  accentTint: "#F3EDFF",

  // Hairlines / Borders
  hairline: "#E9E7EF",
  dividerSoft: "#F1F0F5",
  borderCard: "#E9E7EF",
  accentTintBorder: "rgba(124,58,237,0.20)",

  // Semantic (바이올렛과 어울리게 채도 낮춤)
  error: "#D65C5C",
  danger: "#D65C5C",
  success: "#3C9E79",
  warning: "#C4913C",
  info: "#6366F1",
  hot: "#DE6A4E",
  hotTint: "#FBEDE8",

  // Tabbar
  tabbarBg: "rgba(255,255,255,0.96)",
} as const;

export const darkColors = {
  primary: "#A78BFA",
  primaryFocus: "#C4B5FD",
  primaryPress: "#8B5CF6",
  primaryOnDark: "#120F18",
  primaryTint: "#2A2140",
  primaryDeep: "#C4B5FD",
  action: "#A78BFA",
  actionOn: "#120F18",
  focusRing: "#C4B5FD",

  textPrimary: "#F4F2F8",
  textSecondary: "#C6C1D2",
  textMuted: "#847E93",
  textLink: "#C4B5FD",

  surfacePage: "#120F18",
  surfacePageAlt: "#1B1726",
  surfaceCard: "#1B1726",
  surfaceNav: "#1B1726",
  surfaceSunken: "#231E30",
  canvasParchment: "#231E30",
  pearl: "#231E30",
  tintLavender: "#2A2140",
  accentTint: "#2A2140",

  hairline: "#302A3E",
  dividerSoft: "#231E30",
  borderCard: "#302A3E",
  accentTintBorder: "rgba(167,139,250,0.35)",

  error: "#E06B6B",
  danger: "#E06B6B",
  success: "#4FB08C",
  warning: "#D2A34F",
  info: "#8B8BF0",
  hot: "#E67E64",
  hotTint: "#3A241E",

  tabbarBg: "rgba(27,23,38,0.94)",
} as const;

export type ColorTokens = typeof lightColors;
