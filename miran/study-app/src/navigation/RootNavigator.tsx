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
import { useTheme } from "@/providers/ThemeProvider";
import { Loading, ErrorState } from "@/components";
import { LoginScreen } from "@/screens/LoginScreen";
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
import { DistillNotificationsScreen } from "@/screens/distill/DistillNotificationsScreen";
import { InsighterProfileScreen } from "@/screens/distill/InsighterProfileScreen";
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
  //   예전 익명 로그인 세션이 기기에 남아 있으면 로그인 화면을 건너뛰던 문제를 방지.
  if (!session || session.user.is_anonymous) {
    return <LoginScreen />;
  }

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
        <Stack.Screen name="DistillNotifications" component={DistillNotificationsScreen} />
        <Stack.Screen name="InsighterProfile" component={InsighterProfileScreen} />

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
