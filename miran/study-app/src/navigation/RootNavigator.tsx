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
  const { status, error } = useAuth();

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

  return (
    <NavigationContainer
      theme={navTheme(theme.mode === "dark" ? DarkTheme : DefaultTheme, theme.colors)}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
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
