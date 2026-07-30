import { darkColors, lightColors, type ColorTokens } from "./colors";
import { fontFamily, fontWeight, radius, spacing, typeScale } from "./tokens";

export type ThemeMode = "light" | "dark";

export interface Theme {
  mode: ThemeMode;
  colors: ColorTokens;
  spacing: typeof spacing;
  radius: typeof radius;
  fontWeight: typeof fontWeight;
  fontFamily: typeof fontFamily;
  typeScale: typeof typeScale;
}

export const lightTheme: Theme = {
  mode: "light",
  colors: lightColors,
  spacing,
  radius,
  fontWeight,
  fontFamily,
  typeScale,
};

export const darkTheme: Theme = {
  mode: "dark",
  // darkColors 는 lightColors 와 동일한 키 셋을 가지므로 타입 호환됩니다.
  colors: darkColors as unknown as ColorTokens,
  spacing,
  radius,
  fontWeight,
  fontFamily,
  typeScale,
};

export const getTheme = (mode: ThemeMode): Theme =>
  mode === "dark" ? darkTheme : lightTheme;

export * from "./colors";
export * from "./tokens";
