/**
 * 아카이브 만들기 — 2단계(제목 → 아이콘).
 *
 * 왜 두 걸음으로 나눴나:
 *   한 화면에 입력칸과 아이콘 9개를 같이 두면 무엇부터 할지 애매해진다.
 *   이름은 거의 모두가 쓰지만 아이콘은 건너뛰기 쉬운데, 아이콘이 없으면 그리드에서
 *   타일이 다 비슷해 보여 **나중에 못 찾는다.** 그래서 순서를 강제한다.
 *
 * `archiveId` 가 오면 같은 화면이 수정 모드로 동작한다(제목·아이콘만 고친다).
 */
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { ARCHIVE_ICONS, ARCHIVE_ICON_ORDER, dtype, PRETENDARD } from "@/theme";
import { useArchives, useCreateArchive, useUpdateArchive } from "@/data";

const MAX = 15;

type Props = NativeStackScreenProps<RootStackParamList, "CreateArchive">;

export function CreateArchiveScreen({ route }: Props) {
  const archiveId = route.params?.archiveId ?? null;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const archives = useArchives();
  const create = useCreateArchive();
  const update = useUpdateArchive();

  const existing = archiveId ? (archives.data ?? []).find((a) => a.id === archiveId) : undefined;
  const [stepNo, setStepNo] = useState<1 | 2>(1);
  const [name, setName] = useState(existing?.name ?? "");
  const [icon, setIcon] = useState(existing?.icon ?? "all");

  const trimmed = name.trim();
  const canNext = trimmed.length > 0;
  const busy = create.isPending || update.isPending;

  const finish = () => {
    if (busy) return;
    if (archiveId) {
      update.mutate({ id: archiveId, name: trimmed, icon }, { onSuccess: () => nav.goBack() });
    } else {
      create.mutate({ name: trimmed, icon }, { onSuccess: () => nav.goBack() });
    }
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfaceCard }]} edges={["top", "bottom"]}>
      <View style={styles.bar}>
        <Pressable
          onPress={() => (stepNo === 2 ? setStepNo(1) : nav.goBack())}
          hitSlop={8}
          style={styles.iconBtn}
        >
          <ChevronLeft size={22} color={c.textPrimary} />
        </Pressable>
        <Text style={[styles.barTitle, { color: c.textPrimary }]}>
          {archiveId ? "아카이브 수정" : "아카이브 추가"}
        </Text>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.iconBtn}>
          <X size={20} color={c.textPrimary} />
        </Pressable>
      </View>

      {/* 진행 표시 — 두 칸뿐이라 점이 아니라 막대로 보여준다(몇 걸음 남았는지가 바로 보인다). */}
      <View style={[styles.progress, { backgroundColor: c.surfaceSunken }]}>
        <View style={[styles.progressFill, { backgroundColor: c.textPrimary, width: stepNo === 1 ? "50%" : "100%" }]} />
      </View>

      <KeyboardAvoidingView
        style={styles.fill}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={12}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={[styles.stepNo, { color: c.textMuted }]}>{stepNo}/2</Text>

          {stepNo === 1 ? (
            <>
              <Text style={[styles.question, { color: c.textPrimary }]}>아카이브 제목을 입력하세요.</Text>
              <View style={[styles.inputWrap, { borderColor: c.hairline, backgroundColor: c.surfaceCard }]}>
                <TextInput
                  value={name}
                  onChangeText={(t) => setName(t.slice(0, MAX))}
                  placeholder="예) 지구 지키기"
                  placeholderTextColor={c.textMuted}
                  style={[styles.input, { color: c.textPrimary }]}
                  autoFocus
                  returnKeyType="next"
                  onSubmitEditing={() => canNext && setStepNo(2)}
                />
                <Text style={[styles.counter, { color: c.textMuted }]}>
                  {trimmed.length}/{MAX}
                </Text>
              </View>
            </>
          ) : (
            <>
              <Text style={[styles.question, { color: c.textPrimary }]}>아카이브 아이콘을 선택하세요.</Text>
              <View style={styles.iconGrid}>
                {ARCHIVE_ICON_ORDER.map((key) => {
                  const meta = ARCHIVE_ICONS[key];
                  const Icon = meta.icon;
                  const on = icon === key;
                  return (
                    <Pressable
                      key={key}
                      onPress={() => setIcon(key)}
                      style={[
                        styles.iconCell,
                        { backgroundColor: meta.tint, borderColor: on ? c.primary : "transparent" },
                      ]}
                    >
                      <Icon size={24} color={meta.ink} strokeWidth={2.2} />
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[styles.iconHint, { color: c.textMuted }]}>
                {ARCHIVE_ICONS[icon]?.label ?? ""} · 그리드에서 이 아이콘으로 찾게 돼요
              </Text>
            </>
          )}
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={[
              styles.submit,
              { backgroundColor: (stepNo === 1 ? canNext : true) && !busy ? c.textPrimary : c.surfaceSunken },
            ]}
            disabled={stepNo === 1 ? !canNext : busy}
            onPress={() => (stepNo === 1 ? setStepNo(2) : finish())}
          >
            <Text
              style={[
                styles.submitText,
                { color: (stepNo === 1 ? canNext : true) && !busy ? c.surfaceCard : c.textMuted },
              ]}
            >
              {stepNo === 1 ? "다음" : archiveId ? "저장" : "완료"}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  fill: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, height: 48 },
  barTitle: { ...dtype.cardTitle, flex: 1, textAlign: "center" },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  progress: { height: 3, marginHorizontal: 16, borderRadius: 2, overflow: "hidden" },
  progressFill: { height: 3, borderRadius: 2 },

  content: { padding: 20, gap: 14 },
  stepNo: { ...dtype.meta },
  question: { fontSize: 22, lineHeight: 31, fontWeight: "800", fontFamily: PRETENDARD["800"] },

  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  input: { ...dtype.body, flex: 1, padding: 0 },
  counter: { ...dtype.meta },

  iconGrid: { flexDirection: "row", flexWrap: "wrap", gap: 14, marginTop: 8 },
  iconCell: {
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  iconHint: { ...dtype.bodyS, marginTop: 6 },

  footer: { padding: 16 },
  submit: { borderRadius: 12, paddingVertical: 15, alignItems: "center" },
  submitText: { ...dtype.cardTitle },
});
