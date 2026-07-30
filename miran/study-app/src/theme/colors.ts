/**
 * 색상 토큰 — design_system 정본의 "앱 실제 적용값"(index.html `.app-scope` /
 * `.app-dark` = Slack 어버진 아이덴티티)을 그대로 옮긴 값입니다.
 * design_system/tokens/colors.css 의 Notion 파생 원본이 아니라, dev/README §2
 * 지시대로 어버진 오버라이드를 사용합니다.
 */

export const lightColors = {
  // Brand / Action
  primary: "#4a154b",
  primaryFocus: "#611f69",
  primaryPress: "#611f69",
  primaryOnDark: "#d9bdde",
  action: "#4a154b",
  actionOn: "#ffffff",
  focusRing: "#611f69",

  // Ink / Text
  textPrimary: "#1d1d1d",
  textSecondary: "#454545",
  textMuted: "#696969",
  textLink: "#1264a3",

  // Surfaces
  surfacePage: "#ffffff",
  surfacePageAlt: "#f9f0ff",
  surfaceCard: "#ffffff",
  surfaceNav: "#ffffff",
  canvasParchment: "#f4ede4",
  pearl: "#f4ede4",
  tintLavender: "#f9f0ff",
  accentTint: "#f4ede4",

  // Hairlines / Borders
  hairline: "#e6e6e6",
  dividerSoft: "#f0f0f0",
  borderCard: "#e6e6e6",
  accentTintBorder: "rgba(74,21,75,0.22)",

  // Semantic
  error: "#cc4117",
  success: "#007a5a",

  // Tabbar
  tabbarBg: "rgba(255,255,255,0.94)",
} as const;

export const darkColors = {
  primary: "#c99fce",
  primaryFocus: "#d8b6dc",
  primaryPress: "#b98fbf",
  primaryOnDark: "#c99fce",
  action: "#c99fce",
  actionOn: "#2a0e2c",
  focusRing: "#d8b6dc",

  textPrimary: "#f0e9f1",
  textSecondary: "#c8bccb",
  textMuted: "#9a8a9d",
  textLink: "#9fc0f0",

  surfacePage: "#1a121b",
  surfacePageAlt: "#241a26",
  surfaceCard: "#241a26",
  surfaceNav: "#241a26",
  canvasParchment: "#2c1f2f",
  pearl: "#2c1f2f",
  tintLavender: "#2c1f2f",
  accentTint: "#2c1f2f",

  hairline: "#3a2c3d",
  dividerSoft: "#2c1f2f",
  borderCard: "#3a2c3d",
  accentTintBorder: "rgba(201,159,206,0.4)",

  error: "#cc4117",
  success: "#007a5a",

  tabbarBg: "rgba(30,16,32,0.92)",
} as const;

export type ColorTokens = typeof lightColors;
