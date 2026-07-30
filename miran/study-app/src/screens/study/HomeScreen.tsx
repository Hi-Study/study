import { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  List as ListIcon,
  Plus,
} from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useStudyId } from "@/navigation/StudyContext";
import {
  useSharesByDate,
  useShareDatesInRange,
  type ShareWithMeta,
} from "@/data/shares";
import { useDiscussionsWithMeta, type DiscussionWithMeta } from "@/data/discussions";
import {
  DiscussionRows,
  EmptyState,
  ErrorState,
  GhostIconButton,
  Loading,
  ShareCard,
  SharesSectionList,
} from "@/components";
import { Screen } from "@/components/Chrome";
import {
  addDays,
  currentWeekDates,
  formatMonthDay,
  fromISODate,
  mondayOf,
  monthRangeISO,
  toISODate,
  weekdayMonFirst,
} from "@/lib/date";

/** 월요일 → "M월 N주차" 라벨(토론 week_label 규칙과 동일: 월·ceil(일/7)). */
function weekLabelOf(monday: Date): string {
  return `${monday.getMonth() + 1}월 ${Math.ceil(monday.getDate() / 7)}주차`;
}

/** 그 달에 걸치는 주(월요일)들 — n주차 라벨과 함께. */
function weeksOfMonth(y: number, m: number): { iso: string; label: string }[] {
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const out: { iso: string; label: string }[] = [];
  let d = mondayOf(first);
  let i = 0;
  while (d <= last) {
    out.push({ iso: toISODate(d), label: `${i + 1}주차` });
    d = addDays(d, 7);
    i += 1;
  }
  return out;
}

const MON_FIRST = ["월", "화", "수", "목", "금", "토", "일"];
type HomeTab = "shares" | "discussions";
type ViewMode = "list" | "calendar";

/** 하단 우측 플로팅 CTA(글 공유 / 토론 열기). */
function Fab({ label, onPress }: { label: string; onPress: () => void }) {
  const { theme } = useTheme();
  return (
    <Pressable onPress={onPress} style={[styles.fab, { backgroundColor: theme.colors.primary }]}>
      <Plus size={18} color="#fff" strokeWidth={2.6} />
      <Text style={styles.fabText}>{label}</Text>
    </Pressable>
  );
}

/** 리스트/달력 아이콘 토글(세그먼트 행 우측). */
function ViewToggle({ mode, onChange }: { mode: ViewMode; onChange: (m: ViewMode) => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <View style={[styles.iconToggle, { backgroundColor: c.canvasParchment }]}>
      <Pressable
        onPress={() => onChange("list")}
        style={[styles.iconBtn, mode === "list" && { backgroundColor: c.surfaceCard }]}
      >
        <ListIcon size={18} color={mode === "list" ? c.primary : c.textMuted} />
      </Pressable>
      <Pressable
        onPress={() => onChange("calendar")}
        style={[styles.iconBtn, mode === "calendar" && { backgroundColor: c.surfaceCard }]}
      >
        <CalendarDays size={18} color={mode === "calendar" ? c.primary : c.textMuted} />
      </Pressable>
    </View>
  );
}

/** 홈 — 공유글/토론해요 두 세그먼트를 한 탭에 통합. */
export function HomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const [tab, setTab] = useState<HomeTab>("shares");
  const [mode, setMode] = useState<ViewMode>("list");

  return (
    <Screen scroll={false} edges={["left", "right"]} contentStyle={styles.screen}>
      <View style={styles.topBar}>
        <View style={styles.segRow}>
          <View style={[styles.seg, { backgroundColor: c.canvasParchment }]}>
            {(["shares", "discussions"] as const).map((t) => {
              const on = t === tab;
              return (
                <Pressable
                  key={t}
                  onPress={() => setTab(t)}
                  style={[styles.segItem, on && { backgroundColor: c.surfaceCard }]}
                >
                  <Text style={[styles.segText, { color: on ? c.textPrimary : c.textMuted }]}>
                    {t === "shares" ? "공유글" : "토론해요"}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {/* 뷰 토글(리스트/달력) — 공유글·토론 공통 */}
          <ViewToggle mode={mode} onChange={setMode} />
        </View>
      </View>

      {tab === "shares" ? <SharesPane mode={mode} /> : <DiscussionsPane mode={mode} />}
    </Screen>
  );
}

/** 공유글 — 리스트/달력 + 하단 글 공유 CTA(토글은 상단 세그먼트 행). */
function SharesPane({ mode }: { mode: ViewMode }) {
  const nav = useRootNav();
  const studyId = useStudyId();
  const today = useMemo(() => new Date(), []);
  const openShare = (id: string) => nav.navigate("ShareDetail", { studyId, shareId: id });

  return (
    <View style={styles.flex}>
      {mode === "list" ? (
        <SharesSectionList
          studyId={studyId}
          filter={{}}
          onOpen={openShare}
          emptyTitle="아직 공유된 글이 없어요."
        />
      ) : (
        <WeekView studyId={studyId} today={today} onOpen={openShare} />
      )}
      <Fab
        label="글 공유"
        onPress={() => nav.navigate("CreateShare", { studyId, defaultDay: weekdayMonFirst(today) })}
      />
    </View>
  );
}

/** 달력 뷰 — 주 이동(이전/다음/오늘) + 스트립 + 선택일 목록. */
function WeekView({
  studyId,
  today,
  onOpen,
}: {
  studyId: string;
  today: Date;
  onOpen: (id: string) => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const todayISO = toISODate(today);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selISO, setSelISO] = useState(todayISO);

  const week = useMemo(
    () => currentWeekDates(addDays(today, weekOffset * 7)),
    [today, weekOffset],
  );
  const counts = useShareDatesInRange(studyId, toISODate(week[0]), toISODate(week[6]));
  const dayShares = useSharesByDate(studyId, selISO);
  const list: ShareWithMeta[] = dayShares.data ?? [];

  const shiftWeek = (n: number) => {
    const no = weekOffset + n;
    const w = currentWeekDates(addDays(today, no * 7));
    setWeekOffset(no);
    setSelISO(no === 0 ? todayISO : toISODate(w[0]));
  };
  const goToday = () => {
    setWeekOffset(0);
    setSelISO(todayISO);
  };
  const mmdd = (d: Date) => `${d.getMonth() + 1}.${d.getDate()}`;
  const weekLabel =
    weekOffset === 0
      ? "이번 주"
      : weekOffset === -1
        ? "지난 주"
        : weekOffset === 1
          ? "다음 주"
          : `${mmdd(week[0])} – ${mmdd(week[6])}`;

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.calContent}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={dayShares.isRefetching}
          onRefresh={() => {
            counts.refetch();
            dayShares.refetch();
          }}
          tintColor={c.primary}
        />
      }
    >
      <View style={styles.weekNav}>
        <GhostIconButton onPress={() => shiftWeek(-1)}>
          <ChevronLeft size={20} color={c.textMuted} />
        </GhostIconButton>
        <Pressable onPress={goToday} style={styles.weekLabelWrap}>
          <Text style={[styles.weekLabel, { color: c.textPrimary }]}>{weekLabel}</Text>
          <Text style={[styles.weekRange, { color: c.textMuted }]}>
            {mmdd(week[0])} – {mmdd(week[6])}
          </Text>
        </Pressable>
        <GhostIconButton onPress={() => shiftWeek(1)}>
          <ChevronRight size={20} color={c.textMuted} />
        </GhostIconButton>
      </View>

      <View style={[styles.strip, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
        {week.map((d, i) => {
          const iso = toISODate(d);
          const on = iso === selISO;
          const isToday = iso === todayISO;
          const has = (counts.data?.[iso] ?? 0) > 0;
          const isSun = i === 6;
          const labelColor = on ? c.primary : isSun ? "#c0392b" : i === 5 ? c.primary : c.textMuted;
          const numColor = on ? "#fff" : isToday ? c.primary : isSun ? "#c0392b" : c.textPrimary;
          return (
            <Pressable key={iso} style={styles.stripCell} onPress={() => setSelISO(iso)}>
              <Text style={[styles.stripLabel, { color: labelColor }]}>{MON_FIRST[i]}</Text>
              <View style={[styles.stripCircle, { backgroundColor: on ? c.primary : "transparent" }]}>
                <Text style={[styles.stripNum, { color: numColor }]}>{d.getDate()}</Text>
              </View>
              <View
                style={[
                  styles.stripDot,
                  { backgroundColor: has ? (on ? c.primary : c.textMuted) : "transparent" },
                ]}
              />
            </Pressable>
          );
        })}
      </View>

      <View style={styles.dayHeader}>
        <Text style={[styles.dayTitle, { color: c.textPrimary }]}>
          {formatMonthDay(fromISODate(selISO))}
        </Text>
        <Text style={[styles.dayCount, { color: c.textMuted }]}>공유 {counts.data?.[selISO] ?? 0}</Text>
      </View>

      {dayShares.isLoading ? (
        <Loading />
      ) : dayShares.isError ? (
        <ErrorState message={dayShares.error?.message} onRetry={() => dayShares.refetch()} />
      ) : list.length === 0 ? (
        <EmptyState title="이 날엔 공유된 글이 없어요." />
      ) : (
        <View style={styles.calList}>
          {list.map((s) => (
            <ShareCard key={s.id} share={s} onPress={() => onOpen(s.id)} />
          ))}
        </View>
      )}
    </ScrollView>
  );
}

/** 토론해요 — 리스트(월별) / 달력(주별 ‹ 7월 1주차 ›, 라벨 탭 시 주차 선택). 하단 CTA. */
function DiscussionsPane({ mode }: { mode: ViewMode }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const studyId = useStudyId();
  const today = useMemo(() => new Date(), []);

  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() }); // 리스트: 월
  const [selWeek, setSelWeek] = useState<string>(() => toISODate(mondayOf(today))); // 달력: 주(월요일)
  const [pickerOpen, setPickerOpen] = useState(false);

  const monthWeeks = useMemo(() => weeksOfMonth(view.y, view.m), [view]);
  const monthRange = useMemo(() => {
    const monthEnd = monthRangeISO(view.y, view.m).end;
    const monthStart = monthWeeks[0]?.iso ?? monthRangeISO(view.y, view.m).start;
    return { monthStart, monthEnd };
  }, [view, monthWeeks]);

  const listQuery = useDiscussionsWithMeta(studyId, monthRange, { enabled: mode === "list" });
  const weekQuery = useDiscussionsWithMeta(
    studyId,
    { monthStart: selWeek, monthEnd: selWeek },
    { enabled: mode === "calendar" },
  );
  const q = mode === "list" ? listQuery : weekQuery;
  const rows: DiscussionWithMeta[] = q.data ?? [];
  const pending = rows.filter((d) => d.is_active && !d.participated);

  const shiftMonth = (n: number) =>
    setView((v) => {
      const d = new Date(v.y, v.m + n, 1);
      return { y: d.getFullYear(), m: d.getMonth() };
    });
  const shiftWeek = (n: number) => setSelWeek((w) => toISODate(addDays(fromISODate(w), n * 7)));
  const openDiscussion = (id: string) => nav.navigate("DiscussionDetail", { studyId, discussionId: id });

  const weekLabel = weekLabelOf(fromISODate(selWeek));
  // 주차 선택 드롭다운(미래 3주 ~ 과거 16주)
  const weekOptions = useMemo(() => {
    const base = mondayOf(today);
    return Array.from({ length: 20 }, (_, i) => addDays(base, (3 - i) * 7));
  }, [today]);

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.discContent}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={q.isRefetching} onRefresh={() => q.refetch()} tintColor={c.primary} />
        }
      >
        {pending.length > 0 ? (
          <Pressable
            onPress={() => openDiscussion(pending[0].id)}
            style={[styles.callout, { backgroundColor: c.accentTint }]}
          >
            <View style={[styles.calloutDot, { backgroundColor: c.primary }]} />
            <Text style={[styles.calloutText, { color: c.textPrimary }]}>
              진행 중 토론 <Text style={{ fontWeight: "700" }}>‘{pending[0].title}’</Text>에 아직 의견을 안 남겼어요
            </Text>
            <Text style={[styles.calloutCta, { color: c.primary }]}>참여 ›</Text>
          </Pressable>
        ) : null}

        {/* 리스트=월 이동 / 달력=주 이동(‹ 7월 1주차 ›, 탭하면 주차 선택) */}
        {mode === "list" ? (
          <View style={styles.weekNav}>
            <GhostIconButton onPress={() => shiftMonth(-1)}>
              <ChevronLeft size={20} color={c.textMuted} />
            </GhostIconButton>
            <Text style={[styles.month, { color: c.textPrimary }]}>{view.m + 1}월</Text>
            <GhostIconButton onPress={() => shiftMonth(1)}>
              <ChevronRight size={20} color={c.textMuted} />
            </GhostIconButton>
          </View>
        ) : (
          <View style={styles.weekNav}>
            <GhostIconButton onPress={() => shiftWeek(-1)}>
              <ChevronLeft size={20} color={c.textMuted} />
            </GhostIconButton>
            <Pressable onPress={() => setPickerOpen(true)} style={styles.weekPickBtn}>
              <Text style={[styles.weekPickText, { color: c.textPrimary }]}>{weekLabel}</Text>
              <ChevronDown size={16} color={c.textMuted} />
            </Pressable>
            <GhostIconButton onPress={() => shiftWeek(1)}>
              <ChevronRight size={20} color={c.textMuted} />
            </GhostIconButton>
          </View>
        )}

        {q.isLoading ? (
          <Loading />
        ) : q.isError ? (
          <ErrorState message={q.error?.message} onRetry={() => q.refetch()} />
        ) : rows.length === 0 ? (
          <EmptyState
            title={mode === "calendar" ? `${weekLabel}엔 토론이 없어요.` : `${view.m + 1}월에는 토론이 없어요.`}
          />
        ) : (
          <DiscussionRows rows={rows} onOpen={openDiscussion} />
        )}
      </ScrollView>

      <Fab label="토론 열기" onPress={() => nav.navigate("CreateDiscussion", { studyId })} />

      {/* 주차 선택 드롭다운 */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setPickerOpen(false)}>
          <Pressable style={[styles.pickerSheet, { backgroundColor: c.surfaceCard }]} onPress={() => {}}>
            <Text style={[styles.pickerTitle, { color: c.textPrimary }]}>주차 선택</Text>
            <ScrollView style={{ maxHeight: 340 }}>
              {weekOptions.map((mon) => {
                const iso = toISODate(mon);
                const on = iso === selWeek;
                const end = addDays(mon, 6);
                return (
                  <Pressable
                    key={iso}
                    onPress={() => {
                      setSelWeek(iso);
                      setPickerOpen(false);
                    }}
                    style={[styles.pickerRow, on && { backgroundColor: c.tintLavender }]}
                  >
                    <Text
                      style={[
                        styles.pickerRowText,
                        { color: on ? c.primary : c.textPrimary, fontWeight: on ? "800" : "600" },
                      ]}
                    >
                      {weekLabelOf(mon)}
                    </Text>
                    <Text style={[styles.pickerRange, { color: c.textMuted }]}>
                      {mon.getMonth() + 1}.{mon.getDate()} – {end.getMonth() + 1}.{end.getDate()}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { padding: 0, flex: 1 },
  topBar: { paddingHorizontal: 16, paddingTop: 6, paddingBottom: 4 },
  segRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  seg: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 9 },
  segItem: { paddingVertical: 9, paddingHorizontal: 20, borderRadius: 7, alignItems: "center" },
  segText: { fontSize: 14, fontWeight: "700" },
  iconToggle: { flexDirection: "row", gap: 3, padding: 3, borderRadius: 8 },
  iconBtn: { paddingVertical: 6, paddingHorizontal: 11, borderRadius: 6 },

  fab: {
    position: "absolute",
    right: 16,
    bottom: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 18,
    borderRadius: 90,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
  fabText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  calContent: { padding: 16, paddingTop: 12, paddingBottom: 88, gap: 10 },
  calList: { marginHorizontal: -8 },
  weekNav: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  weekLabelWrap: { alignItems: "center" },
  weekLabel: { fontSize: 15, fontWeight: "700" },
  weekRange: { fontSize: 11.5, marginTop: 1 },
  strip: {
    flexDirection: "row",
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  stripCell: { flex: 1, alignItems: "center", gap: 5, paddingVertical: 4 },
  stripLabel: { fontSize: 11.5, fontWeight: "600" },
  stripCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  stripNum: { fontSize: 15, fontWeight: "600" },
  stripDot: { width: 6, height: 6, borderRadius: 3, overflow: "hidden" },
  dayHeader: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    marginTop: 6,
  },
  dayTitle: { fontSize: 17, fontWeight: "600" },
  dayCount: { fontSize: 13 },

  discContent: { padding: 14, paddingTop: 12, paddingBottom: 88, gap: 12 },
  callout: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    paddingVertical: 11,
    paddingHorizontal: 12,
  },
  calloutDot: { width: 7, height: 7, borderRadius: 3.5 },
  calloutText: { flex: 1, fontSize: 13, lineHeight: 18 },
  calloutCta: { fontSize: 12.5, fontWeight: "600" },
  monthRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  month: { fontSize: 19, fontWeight: "700", letterSpacing: -0.4, minWidth: 48, textAlign: "center" },
  weekPickBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 4, paddingHorizontal: 8 },
  weekPickText: { fontSize: 17, fontWeight: "700", letterSpacing: -0.3 },
  pickerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)", justifyContent: "center", padding: 32 },
  pickerSheet: { borderRadius: 16, padding: 16, gap: 8 },
  pickerTitle: { fontSize: 15, fontWeight: "800", marginBottom: 2 },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 11,
    paddingHorizontal: 12,
    borderRadius: 9,
  },
  pickerRowText: { fontSize: 15 },
  pickerRange: { fontSize: 12.5 },
});
