import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { View } from "react-native";

import { useAuth } from "@/auth/AuthProvider";
import { env } from "@/lib/env";
import { useTheme } from "@/providers/ThemeProvider";
import { useProfile } from "@/data";
import { Loading, ErrorState } from "@/components";
import { LoginScreen } from "@/screens/LoginScreen";
import { OnboardingScreen } from "@/screens/OnboardingScreen";
import { MyStudiesScreen } from "@/screens/MyStudiesScreen";
import { CreateStudyScreen } from "@/screens/CreateStudyScreen";
import { JoinStudyScreen } from "@/screens/JoinStudyScreen";
import { StudyScreen } from "./StudyTabs";
import { ShareDetailScreen } from "@/screens/study/ShareDetailScreen";
import { CreateShareScreen } from "@/screens/study/CreateShareScreen";
import { DiscussionDetailScreen } from "@/screens/study/DiscussionDetailScreen";
import { CreateDiscussionScreen } from "@/screens/study/CreateDiscussionScreen";
import { MembersScreen } from "@/screens/MembersScreen";
import { StudyManageScreen } from "@/screens/StudyManageScreen";
import { StudyEditScreen } from "@/screens/StudyEditScreen";
import { ActivityListScreen } from "@/screens/ActivityListScreen";
import { ProfileEditScreen } from "@/screens/ProfileEditScreen";
import { DisplaySettingsScreen } from "@/screens/DisplaySettingsScreen";
import { NotificationsScreen } from "@/screens/NotificationsScreen";
import { DistillTabs } from "./DistillTabs";
import { ArticleDetailScreen } from "@/screens/distill/ArticleDetailScreen";
import { BlogArticlesScreen } from "@/screens/distill/BlogArticlesScreen";
import { CreateOpinionScreen } from "@/screens/distill/CreateOpinionScreen";
import { OpinionDetailScreen } from "@/screens/distill/OpinionDetailScreen";
import { CreateArticleScreen } from "@/screens/distill/CreateArticleScreen";
import { CreateCommunityPostScreen } from "@/screens/distill/CreateCommunityPostScreen";
import { CommunityPostDetailScreen } from "@/screens/distill/CommunityPostDetailScreen";
import { DistillNotificationsScreen } from "@/screens/distill/DistillNotificationsScreen";
import { InsighterProfileScreen } from "@/screens/distill/InsighterProfileScreen";
import { DayActivityScreen } from "@/screens/distill/DayActivityScreen";
import { DistillSearchScreen } from "@/screens/distill/DistillSearchScreen";
import type { RootStackParamList } from "./types";

const Stack = createNativeStackNavigator<RootStackParamList>();

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
      theme={navTheme(theme.mode === "dark" ? DarkTheme : DefaultTheme, theme.colors)}
    >
      <Stack.Navigator initialRouteName="DistillTabs" screenOptions={{ headerShown: false }}>
        {/* distill (테크블로그 발견) */}
        <Stack.Screen name="DistillTabs" component={DistillTabs} />
        <Stack.Screen name="ArticleDetail" component={ArticleDetailScreen} />
        <Stack.Screen name="BlogArticles" component={BlogArticlesScreen} />
        <Stack.Screen name="CreateOpinion" component={CreateOpinionScreen} />
        <Stack.Screen name="OpinionDetail" component={OpinionDetailScreen} />
        <Stack.Screen name="CreateArticle" component={CreateArticleScreen} />
        <Stack.Screen name="CreateCommunityPost" component={CreateCommunityPostScreen} />
        <Stack.Screen name="CommunityPostDetail" component={CommunityPostDetailScreen} />
        <Stack.Screen name="DistillNotifications" component={DistillNotificationsScreen} />
        <Stack.Screen name="InsighterProfile" component={InsighterProfileScreen} />
        <Stack.Screen name="DayActivity" component={DayActivityScreen} />
        <Stack.Screen name="Search" component={DistillSearchScreen} />

        <Stack.Screen name="MyStudies" component={MyStudiesScreen} />
        <Stack.Screen name="CreateStudy" component={CreateStudyScreen} />
        <Stack.Screen name="JoinStudy" component={JoinStudyScreen} />
        <Stack.Screen name="Notifications" component={NotificationsScreen} />
        <Stack.Screen
          name="Study"
          component={StudyScreen}
          options={{
            headerShown: true,
            title: "스터디",
            headerTitleAlign: "left",
            headerShadowVisible: false,
          }}
        />
        <Stack.Screen name="ShareDetail" component={ShareDetailScreen} />
        <Stack.Screen name="CreateShare" component={CreateShareScreen} />
        <Stack.Screen name="DiscussionDetail" component={DiscussionDetailScreen} />
        <Stack.Screen name="CreateDiscussion" component={CreateDiscussionScreen} />
        <Stack.Screen name="Members" component={MembersScreen} />
        <Stack.Screen name="StudyManage" component={StudyManageScreen} />
        <Stack.Screen name="StudyEdit" component={StudyEditScreen} />
        <Stack.Screen name="ActivityList" component={ActivityListScreen} />
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
