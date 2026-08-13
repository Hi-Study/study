// distill 하단 5탭 — 홈 · 피드 · 토론 · 검색 · 마이 (DESIGN_GUIDE §6.1). + 글쓰기 FAB.
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Pressable, StyleSheet, View } from "react-native";
import { Home, LayoutGrid, MessagesSquare, Pencil, Search, User } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
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
  const nav = useRootNav();
  return (
    <View style={styles.root}>
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

      {/* 글쓰기 FAB(플로팅) — 어디서나 글 등록 */}
      <Pressable
        style={[styles.fab, { backgroundColor: c.primary }]}
        onPress={() => nav.navigate("CreateArticle")}
        hitSlop={8}
      >
        <Pencil size={22} color={c.actionOn} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fab: {
    position: "absolute",
    right: 18,
    bottom: 86,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },
});
