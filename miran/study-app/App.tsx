import { StatusBar } from "expo-status-bar";

import { AppProviders } from "@/providers/AppProviders";
import { useTheme } from "@/providers/ThemeProvider";
import { useAppFonts } from "@/theme/fonts";
import { RootNavigator } from "@/navigation/RootNavigator";
import { Loading } from "@/components";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Platform, View } from "react-native";
import { installWebDragScroll } from "@/lib/webDragScroll";

// 웹에서만 — 마우스로 가로 스크롤(캐러셀·로고 줄·칩 줄)을 끌 수 있게 한다. 자세한 이유는 lib/webDragScroll.
if (Platform.OS === "web") installWebDragScroll();

function Root() {
  const { theme } = useTheme();
  const fontsLoaded = useAppFonts();

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
        <Loading />
      </View>
    );
  }

  return (
    <>
      <StatusBar style={theme.mode === "dark" ? "light" : "dark"} />
      <RootNavigator />
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AppProviders>
        <Root />
      </AppProviders>
    </ErrorBoundary>
  );
}
