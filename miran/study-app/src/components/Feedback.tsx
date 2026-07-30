import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { PillButton } from "./Buttons";

export function Loading({ label }: { label?: string }) {
  const { theme } = useTheme();
  return (
    <View style={styles.center}>
      <ActivityIndicator color={theme.colors.primary} />
      {label ? (
        <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
          {label}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: theme.colors.error }]}>
        문제가 생겼어요
      </Text>
      {message ? (
        <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
          {message}
        </Text>
      ) : null}
      {onRetry ? (
        <PillButton label="다시 시도" onPress={onRetry} variant="lavender" />
      ) : null}
    </View>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  const { theme } = useTheme();
  return (
    <View style={styles.center}>
      <Text style={[styles.title, { color: theme.colors.textSecondary }]}>
        {title}
      </Text>
      {hint ? (
        <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center", gap: 8, padding: 32 },
  title: { fontSize: 15, fontWeight: "600" },
  muted: { fontSize: 13, textAlign: "center" },
});
