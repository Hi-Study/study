/**
 * 비색상 토큰 — design_system/tokens/{spacing,radius,typography,fonts}.css 에서
 * 옮긴 값. 어버진 오버라이드가 radius-pill(90px)·radius-lg(16px) 등 일부를
 * 재정의하므로 그 값을 반영합니다.
 */

// 8px 베이스. 구조는 8/12/16/20/24 에 스냅.
export const spacing = {
  xxs: 4,
  xs: 8,
  sm: 12,
  md: 17, // 17px 본문 리듬
  lg: 24, // 카드 패딩
  xl: 32,
  xxl: 48,
  section: 80,
} as const;

// 어버진 오버라이드 반영: pill 90px, lg 16, md 8, sm 4
export const radius = {
  none: 0,
  xs: 4,
  sm: 4,
  md: 8,
  lg: 16,
  xl: 16,
  pill: 90,
  full: 9999,
} as const;

export const fontWeight = {
  light: "300",
  regular: "400",
  semibold: "600",
  bold: "700",
} as const;

// Pretendard 를 expo-font 로 번들. fonts.css 스택의 첫 글꼴.
export const fontFamily = {
  regular: "Pretendard",
} as const;

// 타입 스케일: size / lineHeight(px) / letterSpacing(px)
export const typeScale = {
  displayMd: { size: 34, lineHeight: 50, letterSpacing: -0.374 },
  lead: { size: 28, lineHeight: 32, letterSpacing: 0.196 },
  tagline: { size: 21, lineHeight: 25, letterSpacing: 0.231 },
  body: { size: 17, lineHeight: 25, letterSpacing: -0.374 },
  bodyStrong: { size: 17, lineHeight: 21, letterSpacing: -0.374 },
  caption: { size: 14, lineHeight: 20, letterSpacing: -0.224 },
  buttonUtil: { size: 14, lineHeight: 18, letterSpacing: -0.224 },
  fine: { size: 12, lineHeight: 12, letterSpacing: -0.12 },
  micro: { size: 10, lineHeight: 13, letterSpacing: -0.08 },
  nav: { size: 12, lineHeight: 12, letterSpacing: -0.12 },
} as const;
