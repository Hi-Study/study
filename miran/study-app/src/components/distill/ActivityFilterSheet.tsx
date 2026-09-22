/**
 * 내 활동 필터 시트 — **기간 · 주제 · 기업 · 서비스 종류.**
 *
 * 주제 하나로만 좁히던 때는 "그 회사 글만" 이나 "이번 달 것만" 을 찾을 수가 없었다.
 * 축은 넷이고 **축마다 하나씩만** 고른다 — 다중 선택을 허용하면 조합이 늘어나
 * 결과가 0건일 때 어느 조건 때문인지 알 수 없다.
 *
 * ⚠️ 고를 수 있는 값은 **내 활동에 실제로 있는 것만** 낸다(빈 목록은 아예 안 그린다).
 *    다만 고른 결과가 0건이어도 **막지는 않는다** — 없으면 없다고 목록이 말한다.
 *
 * 칩을 줄줄이 까는 대신 시트로 둔 이유: 축이 넷이면 칩만 네 줄이 되어 목록보다 필터가 길어진다.
 * 시트 규격은 DESIGN_SYSTEM §4.5 를 따른다.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype, PRETENDARD } from "@/theme";
import {
  PERIOD_LABEL,
  EMPTY_FACETS,
  facetCount,
  type ActivityFacets,
  type ActivityPeriod,
} from "@/lib/myActivity";
import { SERVICE_KIND_META, type ServiceKind } from "@/lib/serviceKind";

const PERIODS: ActivityPeriod[] = ["week", "month", "year"];

export function ActivityFilterSheet({
  visible,
  categories,
  blogs,
  services,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  categories: string[];
  blogs: string[];
  services: ServiceKind[];
  value: ActivityFacets;
  onChange: (next: ActivityFacets) => void;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const n = facetCount(value);

  /** 같은 값을 다시 누르면 꺼진다 — 끄려고 시트를 다시 열게 하지 않는다. */
  const toggle = <K extends keyof ActivityFacets>(key: K, v: ActivityFacets[K]) =>
    onChange({ ...value, [key]: value[key] === v ? null : v });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surfaceCard }]}>
        <View style={[styles.grip, { backgroundColor: c.hairline }]} />
        <View style={styles.head}>
          <Text style={[styles.title, { color: c.textPrimary }]}>필터</Text>
          <View style={{ flex: 1 }} />
          {n > 0 ? (
            <Pressable onPress={() => onChange(EMPTY_FACETS)} hitSlop={8} style={styles.reset}>
              <Text style={[styles.resetText, { color: c.primary }]}>초기화</Text>
            </Pressable>
          ) : null}
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={c.textMuted} />
          </Pressable>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.body}>
          <Group
            title="기간"
            rows={PERIODS.map((p) => ({ key: p, label: PERIOD_LABEL[p] }))}
            selected={value.period}
            onPick={(k) => toggle("period", k as ActivityPeriod)}
          />
          {categories.length > 0 ? (
            <Group
              title="주제"
              rows={categories.map((x) => ({ key: x, label: x }))}
              selected={value.category}
              onPick={(k) => toggle("category", k)}
            />
          ) : null}
          {blogs.length > 0 ? (
            <Group
              title="기업"
              rows={blogs.map((x) => ({ key: x, label: x }))}
              selected={value.blog}
              onPick={(k) => toggle("blog", k)}
            />
          ) : null}
          {services.length > 0 ? (
            <Group
              title="서비스 종류"
              rows={services.map((x) => ({ key: x, label: SERVICE_KIND_META[x].label }))}
              selected={value.service}
              onPick={(k) => toggle("service", k as ServiceKind)}
            />
          ) : null}
        </ScrollView>
      </View>
    </Modal>
  );
}

function Group({
  title,
  rows,
  selected,
  onPick,
}: {
  title: string;
  rows: { key: string; label: string }[];
  selected: string | null;
  onPick: (key: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={styles.group}>
      <Text style={[styles.groupTitle, { color: c.textMuted }]}>{title}</Text>
      <View style={styles.chips}>
        {rows.map((r) => {
          const on = selected === r.key;
          return (
            <Pressable
              key={r.key}
              onPress={() => onPick(r.key)}
              style={[
                styles.chip,
                {
                  borderColor: on ? c.primary : c.hairline,
                  backgroundColor: on ? c.primaryTint : "transparent",
                },
              ]}
            >
              {on ? <Check size={13} color={c.primary} /> : null}
              <Text style={[styles.chipText, { color: on ? c.primary : c.textSecondary }]}>
                {r.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    maxHeight: "72%",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  grip: { width: 40, height: 4, borderRadius: 2, alignSelf: "center", marginTop: 10 },
  head: { flexDirection: "row", alignItems: "center", gap: 12, paddingTop: 14, paddingBottom: 8 },
  title: { ...dtype.title },
  reset: { paddingHorizontal: 4 },
  resetText: { ...dtype.meta, fontWeight: "600", fontFamily: PRETENDARD["600"] },
  body: { gap: 18, paddingBottom: 8 },
  group: { gap: 8 },
  groupTitle: { ...dtype.label, fontSize: 12, letterSpacing: 0.2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  chipText: { ...dtype.meta, fontWeight: "600", fontFamily: PRETENDARD["600"] },
});
