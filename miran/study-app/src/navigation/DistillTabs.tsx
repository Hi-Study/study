// distill 하단 4탭 — 홈 · 피드 · 아카이브 · 마이. 검색은 상단 유틸.
//   아카이브를 탭으로 올린 이유: 저장은 쉬운데 **다시 찾는 길이 마이 안쪽에만** 있었다.
//   담아두고 안 읽는 게 이 서비스의 가장 큰 누수라, 담아둔 것으로 돌아오는 문을 제일 가깝게 둔다.
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FolderOpen, Home, LayoutGrid, User } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { DistillHomeScreen } from "@/screens/distill/DistillHomeScreen";
import { FeedScreen } from "@/screens/distill/FeedScreen";
import { DistillMyPageScreen } from "@/screens/distill/DistillMyPageScreen";
import { ArchiveHomeScreen } from "@/screens/distill/ArchiveHomeScreen";
import type { DistillTabParamList } from "./types";
import { PRETENDARD } from "@/theme";

const Tab = createBottomTabNavigator<DistillTabParamList>();

export function DistillTabs() {
  const { theme } = useTheme();
  const c = theme.colors;
  /**
   * 홈 인디케이터·제스처 바 높이를 **탭 바 높이에 더한다.**
   * 예전엔 `height: 70 / paddingBottom: 12` 로 고정이었다. 안전 영역이 있는 기기에서는
   * 그 영역만큼 탭 바가 아래로 먹혀 **라벨이 잘렸다**(실제로 그렇게 보였다).
   * 아이콘 24 + 라벨 17 + 위아래 여백이 들어갈 56 을 확보하고, 그 아래로 안전 영역을 더한다.
   */
  const insets = useSafeAreaInsets();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: c.primary,
        tabBarInactiveTintColor: c.textMuted,
        tabBarStyle: {
          backgroundColor: c.surfaceNav,
          borderTopColor: c.hairline,
          // 아이콘 24 + 간격 2 + 라벨 15 + 위아래 여백 12 = 53. 넉넉히 66 을 잡고 안전 영역을 더한다.
          height: 66 + insets.bottom,
          paddingTop: 8,
          paddingBottom: 6 + insets.bottom,
        },
        // ⚠️ lineHeight 를 **반드시 명시**한다. 없으면 플랫폼 기본 줄 높이가 칸보다 커서
        //    라벨 아래가 잘린다(실제로 "피드"·"아카이브"의 아랫부분이 잘려 보였다).
        tabBarLabelStyle: {
          fontSize: 11,
          lineHeight: 15,
          fontWeight: "600",
          fontFamily: PRETENDARD["600"],
          marginTop: 2,
          marginBottom: 0,
          includeFontPadding: false,
        },
        // 항목 자체에 여백을 두지 않는다 — 탭 바 padding 과 겹쳐 라벨이 아래로 밀린다.
        tabBarItemStyle: { paddingVertical: 0 },
        tabBarIconStyle: { marginTop: 0 },
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
        name="Archive"
        component={ArchiveHomeScreen}
        options={{ title: "아카이브", tabBarIcon: ({ color, size }) => <FolderOpen color={color} size={size} /> }}
      />
      <Tab.Screen
        name="MyPage"
        component={DistillMyPageScreen}
        options={{ title: "마이", tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }}
      />
    </Tab.Navigator>
  );
}
