import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";

const MAX_TAGS = 10;

/** 태그 입력 — 스페이스/쉼표/엔터로 칩 추가, 칩 눌러 삭제. 값은 string[]. */
export function TagInput({
  tags,
  onChange,
  placeholder = "태그 입력 후 Enter (예: 온보딩)",
}: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [draft, setDraft] = useState("");

  function commit(text: string) {
    const parts = text
      .split(/[,\s]+/)
      .map((s) => s.trim().replace(/^#+/, ""))
      .filter(Boolean);
    if (parts.length === 0) return;
    const next = [...tags];
    for (const p of parts) {
      if (next.length >= MAX_TAGS) break;
      if (!next.includes(p)) next.push(p);
    }
    onChange(next);
    setDraft("");
  }

  function onChangeText(t: string) {
    // 쉼표/공백으로 끝나면 즉시 칩으로 확정
    if (/[,\s]$/.test(t)) commit(t);
    else setDraft(t);
  }

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: c.textPrimary }]}>태그 (선택)</Text>
      <View style={[styles.inputRow, { borderColor: c.hairline, backgroundColor: c.surfaceCard }]}>
        <TextInput
          value={draft}
          onChangeText={onChangeText}
          onSubmitEditing={() => commit(draft)}
          placeholder={placeholder}
          placeholderTextColor={c.textMuted}
          autoCapitalize="none"
          returnKeyType="done"
          blurOnSubmit={false}
          style={[styles.input, { color: c.textPrimary }]}
        />
      </View>
      {tags.length > 0 ? (
        <View style={styles.chips}>
          {tags.map((t) => (
            <Pressable
              key={t}
              onPress={() => onChange(tags.filter((x) => x !== t))}
              style={[styles.chip, { backgroundColor: c.tintLavender }]}
            >
              <Text style={[styles.chipText, { color: c.primary }]}>#{t}</Text>
              <X size={12} color={c.primary} />
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { fontSize: 13, fontWeight: "600" },
  inputRow: { borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 4 },
  input: { fontSize: 15, paddingVertical: 8 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 90,
    paddingVertical: 5,
    paddingHorizontal: 11,
  },
  chipText: { fontSize: 12.5, fontWeight: "700" },
});
