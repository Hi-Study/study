import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View } from "react-native";
import * as Linking from "expo-linking";

import { useAuth } from "@/auth/AuthProvider";
import { env } from "@/lib/env";
import { useTheme } from "@/providers/ThemeProvider";
import { useProfile } from "@/data";
import { Loading, ErrorState } from "@/components";
import { LoginScreen } from "@/screens/LoginScreen";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { ProfileEditScreen } from "@/screens/ProfileEditScreen";
import { DisplaySettingsScreen } from "@/screens/DisplaySettingsScreen";
import { DistillTabs } from "./DistillTabs";
import { ArticleDetailScreen } from "@/screens/distill/ArticleDetailScreen";
import { BlogArticlesScreen } from "@/screens/distill/BlogArticlesScreen";
import { CreateOpinionScreen } from "@/screens/distill/CreateOpinionScreen";
import { ArticleWebViewScreen } from "@/screens/distill/ArticleWebViewScreen";
import { ArchiveDetailScreen } from "@/screens/distill/ArchiveDetailScreen";
import { CreateArchiveScreen } from "@/screens/distill/CreateArchiveScreen";
import { DayActivityScreen } from "@/screens/distill/DayActivityScreen";
import { DistillSearchScreen } from "@/screens/distill/DistillSearchScreen";
import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * 주소 연결(linking) — 화면마다 URL 을 준다.
 *
 * 웹에서는 이게 없으면 **브라우저 뒤로가기가 앱과 따로 논다.** 어느 화면으로 가든 주소가
 * 그대로라 브라우저는 "이동한 적 없음"으로 보고, 뒤로가기를 누르면 앱 밖으로 나가버린다.
 * 화면과 주소를 묶어두면 뒤로가기·앞으로가기·새로고침·링크 공유가 전부 자연스러워진다.
 *
 * 네이티브에서도 같은 표를 쓴다(scheme: studyapp) — 딥링크 규칙이 두 벌이 되지 않게.
 */
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: [Linking.createURL("/"), "https://distill.app"],
  config: {
    screens: {
      DistillTabs: {
        // 탭은 경로의 첫 칸을 차지한다. 홈은 루트("")라 첫 화면 주소가 지저분해지지 않는다.
        screens: { Home: "", Feed: "feed", Archive: "archive", MyPage: "my" },
      },
      ArticleDetail: "article/:articleId",
      ArticleWebView: "article/original",
      BlogArticles: "blog/:blogId",
      CreateOpinion: "article/:articleId/write",
      ArchiveDetail: "archive/detail",
      CreateArchive: "archive/new",
      DayActivity: "activity/:date",
      Search: "search",
      ProfileEdit: "settings/profile",
      DisplaySettings: "settings",
    },
  },
};

function navTheme(base: NavTheme, colors: ReturnType<typeof useTheme>["theme"]["colors"]): NavTheme {
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: colors.primary,
      background: colors.surfacePage,
      card: colors.surfaceCard,
      text: colors.textPrimary,
      border: colors.hairline,
    },
  };
}

/** 세션 준비 게이트 — 익명 로그인 완료 전에는 화면을 마운트하지 않는다. */
function Gate() {
  const { theme } = useTheme();
  const { status, session, error } = useAuth();

  if (status === "loading") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
        <Loading label="세션 준비 중…" />
      </View>
    );
  }
  if (status === "error") {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage, justifyContent: "center" }}>
        <ErrorState message={error ?? undefined} />
      </View>
    );
  }
  // 세션이 없거나 '익명(게스트) 세션'이면 → 로그인 화면(구글).
  //   ⚠️ 예외는 EXPO_PUBLIC_ALLOW_ANON_BROWSE=1 을 켰을 때뿐(화면 확인용 둘러보기).
  //   기본값 + 운영 빌드에서는 앱 진입 시 항상 로그인 화면부터 뜬다.
  if (!session || (session.user.is_anonymous && !env.allowAnonBrowse)) {
    return <LoginScreen />;
  }

  return <OnboardingGate />;
}

/**
 * 온보딩 게이트 — 직무(job_role)를 아직 안 받았으면 온보딩 1화면을 먼저 띄운다.
 * 직무는 역할별 요약 · 직군 배지 · 단어장 개인화의 **전제**라서 앱보다 먼저 받는다.
 * ⚠️ 프로필을 못 읽어도(네트워크 오류 등) 앱을 막지 않는다 — 온보딩은 다음에 다시 뜬다.
 */
function OnboardingGate() {
  const { theme } = useTheme();
  const profile = useProfile();

  if (profile.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
        <Loading label="불러오는 중…" />
      </View>
    );
  }
  if (profile.data && !profile.data.onboarded_at) return <OnboardingScreen />;
  return <AppStack />;
}

function AppStack() {
  const { theme } = useTheme();
  return (
    <NavigationContainer
      linking={linking}
      theme={navTheme(theme.mode === "dark" ? DarkTheme : DefaultTheme, theme.colors)}
    >
      <Stack.Navigator initialRouteName="DistillTabs" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="DistillTabs" component={DistillTabs} />
        <Stack.Screen name="ArticleDetail" component={ArticleDetailScreen} />
        <Stack.Screen name="BlogArticles" component={BlogArticlesScreen} />
        <Stack.Screen name="CreateOpinion" component={CreateOpinionScreen} />
        <Stack.Screen name="DayActivity" component={DayActivityScreen} />
        <Stack.Screen name="ArticleWebView" component={ArticleWebViewScreen} />
        <Stack.Screen name="ArchiveDetail" component={ArchiveDetailScreen} />
        <Stack.Screen
          name="CreateArchive"
          component={CreateArchiveScreen}
          options={{ presentation: "modal" }}
        />
        <Stack.Screen name="Search" component={DistillSearchScreen} />

        <Stack.Screen name="ProfileEdit" component={ProfileEditScreen} />
        <Stack.Screen name="DisplaySettings" component={DisplaySettingsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export function RootNavigator() {
  return (
    <SafeAreaProvider>
      <Gate />
    </SafeAreaProvider>
  );
}
