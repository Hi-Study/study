import { StatusBar } from "expo-status-bar";

import { AppProviders } from "@/providers/AppProviders";
import { useTheme } from "@/providers/ThemeProvider";
import { useAppFonts } from "@/theme/fonts";
import { RootNavigator } from "@/navigation/RootNavigator";
import { Loading } from "@/components";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { View } from "react-native";

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
