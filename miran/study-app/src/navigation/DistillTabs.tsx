// distill 하단 5탭 — 홈 · 피드 · 토론 · 검색 · 마이 (DESIGN_GUIDE §6.1).
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, LayoutGrid, MessagesSquare, Search, User } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { DistillHomeScreen } from "@/screens/distill/DistillHomeScreen";
import { DiscussScreen } from "@/screens/distill/DiscussScreen";
import { FeedScreen } from "@/screens/distill/FeedScreen";
import { DistillSearchScreen } from "@/screens/distill/DistillSearchScreen";
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
        tabBarStyle: { backgroundColor: c.surfaceNav, borderTopColor: c.hairline },
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
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
        name="Discuss"
        component={DiscussScreen}
        options={{ title: "토론", tabBarIcon: ({ color, size }) => <MessagesSquare color={color} size={size} /> }}
      />
      <Tab.Screen
        name="Search"
        component={DistillSearchScreen}
        options={{ title: "검색", tabBarIcon: ({ color, size }) => <Search color={color} size={size} /> }}
      />
      <Tab.Screen
        name="MyPage"
        component={DistillMyPageScreen}
        options={{ title: "마이", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
