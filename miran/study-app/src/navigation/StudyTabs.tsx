import { useEffect } from "react";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useNavigation, type RouteProp } from "@react-navigation/native";
import { Pressable, StyleSheet, View } from "react-native";
import { Bell, Home, Search, User } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { StudyProvider, useStudyId } from "./StudyContext";
import { useRootNav, type RootNav, type RootStackParamList, type StudyTabParamList } from "./types";
import { useStudy } from "@/data/studies";
import { useUnreadNotifications } from "@/data/notifications";
import { RedDot } from "@/components";
import { HomeScreen } from "@/screens/study/HomeScreen";
import { SearchScreen } from "@/screens/study/SearchScreen";
import { MyPageScreen } from "@/screens/study/MyPageScreen";
import { PRETENDARD } from "@/theme";

const Tab = createBottomTabNavigator<StudyTabParamList>();

/** 최상단 nav(스터디명) 우측 — 알림함(안 읽음 빨간 점). */
function BellButton() {
  const { theme } = useTheme();
  const nav = useRootNav();
  const unread = useUnreadNotifications();
  const has = (unread.data ?? 0) > 0;
  return (
    <Pressable onPress={() => nav.navigate("Notifications")} hitSlop={8} style={styles.bellBtn}>
      <View>
        <Bell size={22} color={theme.colors.textPrimary} />
        {has ? (
          <View style={styles.bellDot}>
            <RedDot size={7} />
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

/** 최상단 RootStack 헤더에 스터디명(제목)과 알림 벨(우측)을 세팅. */
function StudyHeaderSync() {
  const nav = useNavigation<RootNav>();
  const studyId = useStudyId();
  const study = useStudy(studyId);
  const name = study.data?.name;
  useEffect(() => {
    nav.setOptions({
      title: name ?? "스터디",
      headerRight: () => <BellButton />,
    });
  }, [nav, name]);
  return null;
}

function StudyTabs() {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.surfaceCard,
          borderTopColor: c.hairline,
          borderTopWidth: StyleSheet.hairlineWidth,
          elevation: 0,
          shadowOpacity: 0,
          shadowColor: "transparent",
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600", fontFamily: PRETENDARD["600"] },
      }}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{ title: "홈", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Search"
        component={SearchScreen}
        options={{ title: "검색", tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }}
      />
      <Tab.Screen
        name="MyPage"
        component={MyPageScreen}
        options={{ title: "마이", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}

/** RootStack 의 'Study' 진입점 — studyId 를 컨텍스트로 제공하고 탭을 렌더. */
export function StudyScreen({
  route,
}: {
  route: RouteProp<RootStackParamList, "Study">;
}) {
  return (
    <StudyProvider studyId={route.params.studyId}>
      <StudyHeaderSync />
      <StudyTabs />
    </StudyProvider>
  );
}

const styles = StyleSheet.create({
  bellBtn: { paddingLeft: 14 },
  bellDot: { position: "absolute", top: -3, right: -3 },
});
