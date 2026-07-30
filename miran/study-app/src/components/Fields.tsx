import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from "react-native";
import { Search, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";

interface FieldProps extends TextInputProps {
  label?: string;
  containerStyle?: ViewStyle;
  multiline?: boolean;
}

/** 라벨 + 흰 배경 입력 필드(1px hairline, 라운드 8px). */
export function TextField({ label, containerStyle, multiline, style, ...rest }: FieldProps) {
  const { theme } = useTheme();
  return (
    <View style={containerStyle}>
      {label ? (
        <Text style={[styles.label, { color: theme.colors.textPrimary }]}>
          {label}
        </Text>
      ) : null}
      <TextInput
        placeholderTextColor={theme.colors.textMuted}
        multiline={multiline}
        style={[
          styles.input,
          {
            backgroundColor: theme.colors.surfaceCard,
            borderColor: theme.colors.hairline,
            color: theme.colors.textPrimary,
            height: multiline ? 110 : 46,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
        {...rest}
      />
    </View>
  );
}

/** 라벤더 채움 검색 필드(좌측 돋보기). */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  containerStyle,
  autoFocus,
  onClear,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  containerStyle?: ViewStyle;
  autoFocus?: boolean;
  /** 지우기 버튼(X) 표시 — 값이 있을 때만 노출. */
  onClear?: () => void;
}) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.search,
        { backgroundColor: theme.colors.tintLavender },
        containerStyle,
      ]}
    >
      <Search size={18} color={theme.colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        autoFocus={autoFocus}
        returnKeyType="search"
        style={[styles.searchInput, { color: theme.colors.textPrimary }]}
      />
      {onClear && value.length > 0 ? (
        <Pressable onPress={onClear} hitSlop={8}>
          <X size={16} color={theme.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: "600", marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
});
