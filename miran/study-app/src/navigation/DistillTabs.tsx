// distill 하단 4탭 — 홈 · 피드 · 인사이트 · 마이 (회의록 2026-08-18). 검색은 상단 유틸.
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, LayoutGrid, MessagesSquare, User } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { DistillHomeScreen } from "@/screens/distill/DistillHomeScreen";
import { DiscussScreen } from "@/screens/distill/DiscussScreen";
import { FeedScreen } from "@/screens/distill/FeedScreen";
import { DistillMyPageScreen } from "@/screens/distill/DistillMyPageScreen";
import type { DistillTabParamList } from "./types";

const Tab = createBottomTabNavigator<DistillTabParamList>();

export function DistillTabs() {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.surfaceNav,
          borderTopColor: c.hairline,
          height: 70,
          paddingTop: 8,
          paddingBottom: 12,
        },
        tabBarLabelStyle: { fontSize: 11.5, fontWeight: "600", marginTop: 2 },
      }}
    >
      <Tab.Screen
        name="Home"
        component={DistillHomeScreen}
        options={{ title: "홈", tabBarIcon: ({ color, size }) => <Home color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Feed"
        component={FeedScreen}
        options={{ title: "피드", tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Insight"
        component={DiscussScreen}
        options={{ title: "인사이트", tabBarIcon: ({ color, size }) => <MessagesSquare color={color} size={size} /> }}
      />
      <Tab.Screen
        name="MyPage"
        component={DistillMyPageScreen}
        options={{ title: "마이", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
