import type { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ChevronLeft } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { GhostIconButton } from "./Buttons";

/**
 * 화면 바깥 컨테이너(안전영역 + 페이지 배경).
 * - header: 스크롤과 무관하게 상단에 고정되는 헤더 슬롯.
 * - keyboardAvoiding: 키보드가 올라오면 내용이 위로(입력 폼용).
 * - onRefresh: 당겨서 새로고침.
 */
export function Screen({
  children,
  header,
  scroll = true,
  contentStyle,
  edges,
  refreshing,
  onRefresh,
  keyboardAvoiding = false,
}: {
  children: ReactNode;
  header?: ReactNode;
  scroll?: boolean;
  contentStyle?: ViewStyle;
  edges?: ("top" | "bottom" | "left" | "right")[];
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboardAvoiding?: boolean;
}) {
  const { theme } = useTheme();
  const bg = { backgroundColor: theme.colors.surfacePage };

  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={Boolean(refreshing)}
            onRefresh={onRefresh}
            tintColor={theme.colors.primary}
            colors={[theme.colors.primary]}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, contentStyle]}>{children}</View>
  );

  return (
    <SafeAreaView style={[styles.flex, bg]} edges={edges ?? ["top", "left", "right"]}>
      {header ? <View style={styles.fixedHeader}>{header}</View> : null}
      {keyboardAvoiding ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          {body}
        </KeyboardAvoidingView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

/** 상단 헤더: (뒤로) + 제목 + 우측 액션. */
export function ScreenHeader({
  title,
  emoji,
  onBack,
  right,
}: {
  title: string;
  emoji?: string;
  onBack?: () => void;
  right?: ReactNode;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        {onBack ? (
          <GhostIconButton onPress={onBack}>
            <ChevronLeft size={26} color={theme.colors.textPrimary} />
          </GhostIconButton>
        ) : null}
        <Text style={[styles.title, { color: theme.colors.textPrimary }]}>
          {emoji ? `${emoji} ` : ""}
          {title}
        </Text>
      </View>
      <View style={styles.headerRight}>{right}</View>
    </View>
  );
}

/** 섹션 라벨(예: "내 스터디"). */
export function SectionLabel({ children }: { children: ReactNode }) {
  const { theme } = useTheme();
  return (
    <Text style={[styles.section, { color: theme.colors.textMuted }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scrollContent: { padding: 16, paddingBottom: 40, gap: 12 },
  fixedHeader: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 44,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 4, flexShrink: 1 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontSize: 22, fontWeight: "700", letterSpacing: -0.4 },
  section: { fontSize: 13, fontWeight: "600", marginTop: 4 },
});
