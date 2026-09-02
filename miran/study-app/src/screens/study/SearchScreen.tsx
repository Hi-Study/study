import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { useStudyId } from "@/navigation/StudyContext";
import { useShareTags, type ShareFeedFilter } from "@/data/shares";
import { useDiscussionsWithMeta, useDiscussionTags, type DiscussionWithMeta } from "@/data/discussions";
import {
  DiscussionRows,
  EmptyState,
  ErrorState,
  Loading,
  SearchField,
  SharesSectionList,
  type DateKey,
} from "@/components";
import { Screen } from "@/components/Chrome";
import { dateRangeFor } from "@/lib/date";
import { PRETENDARD } from "@/theme";

const ALL_TIME = { monthStart: "1900-01-01", monthEnd: "2999-12-31" };
type Scope = "shares" | "discussions";
type Kind = "link" | "text" | null;

const DATE_OPTS: { k: DateKey; label: string }[] = [
  { k: "all", label: "전체 기간" },
  { k: "week", label: "이번 주" },
  { k: "month", label: "이번 달" },
];

/** 필터 칩(선택 시 보라 채움). */
function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? c.primary : c.surfaceCard, borderColor: active ? c.primary : c.hairline },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? "#fff" : c.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

/** 검색 — 이커머스식. 검색 전엔 인기 태그로 발견, 검색하면 공유글/토론 탭 + 다양한 필터. */
export function SearchScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const studyId = useStudyId();
  const nav = useRootNav();

  const [q, setQ] = useState("");
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const [scope, setScope] = useState<Scope>("shares");
  const [tags, setTags] = useState<string[]>([]);
  const [dateKey, setDateKey] = useState<DateKey>("all");
  const [kind, setKind] = useState<Kind>(null);

  const shareTags = useShareTags(studyId);
  const discTags = useDiscussionTags(studyId);
  const allTags = useMemo(
    () => [...new Set([...(shareTags.data ?? []), ...(discTags.data ?? [])])].sort(),
    [shareTags.data, discTags.data],
  );
  const scopeTags = scope === "shares" ? shareTags.data ?? [] : discTags.data ?? [];
  // 선택한 태그는 스코프에 없어도 항상 칩으로 보이게(선택/해제 가능).
  const tagChips = useMemo(() => [...new Set([...scopeTags, ...tags])], [scopeTags, tags]);

  const active = Boolean(debounced || tags.length > 0 || dateKey !== "all" || kind);
  const toggleTag = (t: string) =>
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));
  const changeScope = (s: Scope) => {
    setScope(s);
    setKind(null); // 종류는 공유글 전용
  };

  return (
    <Screen scroll={false} edges={["left", "right"]} contentStyle={styles.screen}>
      {/* 히어로 검색바 */}
      <View style={styles.hero}>
        <SearchField
          value={q}
          onChangeText={setQ}
          onClear={() => setQ("")}
          placeholder="공유글 · 토론 검색"
          autoFocus
          containerStyle={styles.heroSearch}
        />
      </View>

      {!active ? (
        // 검색 전 — 인기 태그로 발견
        <ScrollView contentContainerStyle={styles.discovery} keyboardShouldPersistTaps="handled">
          <Text style={[styles.discLead, { color: c.textPrimary }]}>무엇을 찾고 있나요?</Text>
          <Text style={[styles.discSub, { color: c.textMuted }]}>
            제목·내용·태그로 공유글과 토론을 검색해요.
          </Text>
          {allTags.length > 0 ? (
            <>
              <Text style={[styles.discTitle, { color: c.textPrimary }]}>인기 태그</Text>
              <View style={styles.tagCloud}>
                {allTags.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => toggleTag(t)}
                    style={[styles.bigTag, { backgroundColor: c.tintLavender }]}
                  >
                    <Text style={[styles.bigTagText, { color: c.primary }]}>#{t}</Text>
                  </Pressable>
                ))}
              </View>
            </>
          ) : null}
        </ScrollView>
      ) : (
        <>
          {/* 검색 후 — 스코프 탭 */}
          <View style={styles.scopeTabs}>
            {(["shares", "discussions"] as const).map((s) => {
              const on = s === scope;
              return (
                <Pressable key={s} onPress={() => changeScope(s)} style={styles.scopeTab}>
                  <Text style={[styles.scopeText, { color: on ? c.textPrimary : c.textMuted }]}>
                    {s === "shares" ? "공유글" : "토론"}
                  </Text>
                  <View style={[styles.scopeBar, { backgroundColor: on ? c.primary : "transparent" }]} />
                </Pressable>
              );
            })}
          </View>

          {/* 다양한 필터(가로 스크롤): 날짜·종류(공유글) + 태그 */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterRow}
            keyboardShouldPersistTaps="handled"
          >
            {scope === "shares" ? (
              <>
                {DATE_OPTS.map((o) => (
                  <Chip key={o.k} label={o.label} active={dateKey === o.k} onPress={() => setDateKey(o.k)} />
                ))}
                <View style={[styles.filterDivider, { backgroundColor: c.hairline }]} />
                <Chip label="링크" active={kind === "link"} onPress={() => setKind(kind === "link" ? null : "link")} />
                <Chip label="직접작성" active={kind === "text"} onPress={() => setKind(kind === "text" ? null : "text")} />
                {tagChips.length > 0 ? <View style={[styles.filterDivider, { backgroundColor: c.hairline }]} /> : null}
              </>
            ) : null}
            {tagChips.map((t) => (
              <Chip key={t} label={`#${t}`} active={tags.includes(t)} onPress={() => toggleTag(t)} />
            ))}
          </ScrollView>

          {scope === "shares" ? (
            <ShareResults
              filter={{
                search: debounced || undefined,
                tags: tags.length ? tags : undefined,
                kind: kind ?? undefined,
                ...dateRangeToFilter(dateKey),
              }}
              onOpen={(id) => nav.navigate("ShareDetail", { studyId, shareId: id })}
              studyId={studyId}
            />
          ) : (
            <DiscussionResults
              studyId={studyId}
              search={debounced}
              tags={tags}
              onOpen={(id) => nav.navigate("DiscussionDetail", { studyId, discussionId: id })}
            />
          )}
        </>
      )}
    </Screen>
  );
}

function dateRangeToFilter(dateKey: DateKey): { dateFrom?: string; dateTo?: string } {
  const r = dateRangeFor(dateKey, new Date());
  return { dateFrom: r.from, dateTo: r.to };
}

function ShareResults({
  studyId,
  filter,
  onOpen,
}: {
  studyId: string;
  filter: ShareFeedFilter;
  onOpen: (id: string) => void;
}) {
  return (
    <SharesSectionList studyId={studyId} filter={filter} onOpen={onOpen} emptyTitle="검색 결과가 없어요." />
  );
}

function DiscussionResults({
  studyId,
  search,
  tags,
  onOpen,
}: {
  studyId: string;
  search: string;
  tags: string[];
  onOpen: (id: string) => void;
}) {
  const range = useMemo(
    () => ({ ...ALL_TIME, search: search || undefined, tags: tags.length ? tags : undefined }),
    [search, tags],
  );
  const list = useDiscussionsWithMeta(studyId, range);
  const rows: DiscussionWithMeta[] = list.data ?? [];
  return (
    <ScrollView style={styles.flex} contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled">
      {list.isLoading ? (
        <Loading />
      ) : list.isError ? (
        <ErrorState message={list.error?.message} onRetry={() => list.refetch()} />
      ) : rows.length === 0 ? (
        <EmptyState title="검색 결과가 없어요." />
      ) : (
        <DiscussionRows rows={rows} onOpen={onOpen} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { padding: 0, flex: 1 },
  hero: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 6 },
  heroSearch: { height: 52, borderRadius: 12 },

  discovery: { padding: 16, gap: 10 },
  discLead: { fontSize: 18, fontWeight: "800", fontFamily: PRETENDARD["800"], letterSpacing: -0.3 },
  discSub: { fontSize: 13, lineHeight: 19, marginTop: -4 },
  discTitle: { fontSize: 14, fontWeight: "800", fontFamily: PRETENDARD["800"], marginTop: 6 },
  tagCloud: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  bigTag: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 90 },
  bigTagText: { fontSize: 14, fontWeight: "700", fontFamily: PRETENDARD["700"] },

  scopeTabs: { flexDirection: "row", gap: 20, paddingHorizontal: 18, paddingTop: 2 },
  scopeTab: { alignItems: "center", gap: 6 },
  scopeText: { fontSize: 15, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  scopeBar: { height: 2.5, width: "100%", borderRadius: 2 },

  filterRow: { flexDirection: "row", alignItems: "center", gap: 7, paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10 },
  filterDivider: { width: 1, height: 20, marginHorizontal: 3 },
  chip: { borderWidth: 1, borderRadius: 90, paddingVertical: 6, paddingHorizontal: 13 },
  chipText: { fontSize: 12.5, fontWeight: "600", fontFamily: PRETENDARD["600"] },

  results: { padding: 14, paddingTop: 8, gap: 12 },
});
