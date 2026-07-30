import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ViewStyle,
} from "react-native";

import { useTheme } from "@/providers/ThemeProvider";

interface PillProps {
  label: string;
  onPress: () => void;
  variant?: "primary" | "lavender";
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
}

/** 어버진/라벤더 알약 버튼(라운드 90px). press 시 #611f69. */
export function PillButton({
  label,
  onPress,
  variant = "primary",
  disabled,
  loading,
  style,
}: PillProps) {
  const { theme } = useTheme();
  const isPrimary = variant === "primary";
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.pill,
        {
          backgroundColor: isPrimary
            ? pressed
              ? theme.colors.primaryPress
              : theme.colors.primary
            : theme.colors.tintLavender,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={isPrimary ? "#fff" : theme.colors.primary} />
      ) : (
        <Text
          style={[
            styles.pillLabel,
            { color: isPrimary ? theme.colors.actionOn : theme.colors.primary },
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

interface TextButtonProps {
  label: string;
  onPress: () => void;
  color?: string;
  style?: ViewStyle;
}

/** 텍스트만 있는 인라인 버튼(예: "+ 글 공유"). */
export function TextButton({ label, onPress, color, style }: TextButtonProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }, style]}
    >
      <Text style={[styles.textBtn, { color: color ?? theme.colors.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}

interface CtaButtonProps {
  label: string;
  onPress: () => void;
  icon?: React.ReactNode;
  style?: ViewStyle;
}

/** 채워진 콤팩트 CTA(예: 헤더의 "글 공유"). 눈에 띄는 어버진 배경 + 흰 글씨. */
export function CtaButton({ label, onPress, icon, style }: CtaButtonProps) {
  const { theme } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.cta,
        { backgroundColor: pressed ? theme.colors.primaryPress : theme.colors.primary },
        style,
      ]}
    >
      {icon}
      <Text style={[styles.ctaLabel, { color: theme.colors.actionOn }]}>{label}</Text>
    </Pressable>
  );
}

interface IconButtonProps {
  onPress: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

/** 헤더용 고스트 아이콘 버튼(34px 터치영역). */
export function GhostIconButton({ onPress, children, style }: IconButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconBtn,
        { opacity: pressed ? 0.5 : 1 },
        style,
      ]}
    >
      <View>{children}</View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pill: {
    height: 48,
    borderRadius: 90,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  pillLabel: { fontSize: 16, fontWeight: "600", letterSpacing: -0.2 },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 38,
    borderRadius: 90,
    paddingHorizontal: 16,
  },
  ctaLabel: { fontSize: 14, fontWeight: "700", letterSpacing: -0.2 },
  textBtn: { fontSize: 14, fontWeight: "600" },
  iconBtn: {
    width: 34,
    height: 34,
    alignItems: "center",
    justifyContent: "center",
  },
});
