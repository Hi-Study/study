import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";

import { getTheme, type Theme, type ThemeMode } from "@/theme";

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  /** 사용자가 마이페이지 > 화면 설정에서 명시 선택한 값. null 이면 OS 설정을 따름. */
  override: ThemeMode | null;
  setOverride: (mode: ThemeMode | null) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * 테마 컨텍스트. OS 색상 모드를 기본으로 하되, users.theme(라이트/다크) 설정으로
 * 덮어쓸 수 있습니다(dev/api.md §1 화면 설정). 서버 값 동기화는 화면 구현 시 연결.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const [override, setOverride] = useState<ThemeMode | null>(null);

  const value = useMemo<ThemeContextValue>(() => {
    const mode: ThemeMode = override ?? (system === "dark" ? "dark" : "light");
    return { theme: getTheme(mode), mode, override, setOverride };
  }, [override, system]);

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme 는 ThemeProvider 내부에서만 사용하세요.");
  return ctx;
}
