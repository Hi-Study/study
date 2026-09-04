// 피드/인사이트 상단 필터 — 현대백화점(더현대 서울)식 구성.
//   ① 상단 유틸 아이콘 줄(검색 등) — 카드 바깥, 이미지의 우측 상단 아이콘 자리.
//   ② **히어로 카드** — 카드 안쪽에 "지금 보는 곳"(작게) + 기업명 ∨(화면 최대 크기) + 브랜드 로고,
//      그 아래 인사 배너("○○님 안녕하세요! / {기업} 글 N개를 모았어요").
//      → 큰 텍스트가 화면 맨 위에 덜렁 붙지 않고 카드 여백 안쪽 아래에 자리잡는다.
//      → 기업명 탭하면 바텀시트에서 기업 전환(단일 선택, 고르는 즉시 적용).
//   ③ 그 아래 작은 드롭다운 필터 칩 `[카테고리 ▾] [정렬 ▾]`
//      → 탭하면 하단 바텀시트(탭 전환) + 체크 선택 + "N개 글 보기"로 적용.
//
//   variant="chips" (검색·인사이트) — 히어로 카드 없이 `[기업 ▾] [카테고리 ▾] [정렬 ▾]` 칩만.
//      기업도 카테고리와 **같은 칩 디자인 · 같은 바텀시트 탭**으로 고른다.
//   variant="sort" (커뮤니티) — `[정렬 ▾]` 하나만. 자유글엔 기업·주제가 없어서
//      고를 게 정렬뿐인데, 필터 줄 자체가 없으면 "여긴 왜 아무것도 없지"가 된다.
import React, { useMemo, useState } from "react";
import { Dimensions, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Check, ChevronDown, RotateCcw, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { LEVEL_META, LEVEL_ORDER, TOPIC_META, TOPIC_ORDER, dtype , PRETENDARD} from "@/theme";
import type { BlogRow } from "@/types/tables";
import type { ArticleLevel, Topic } from "@/types/database";
import { useArticlesFeedCount, useProfile } from "@/data";
import { ServiceLogo } from "@/components/distill/ArticleCards";

export type FeedSort = "latest" | "popular";
type Tab = "blog" | "topic" | "level" | "sort";

const W = Dimensions.get("window").width;
const SHEET_LIST_H = Math.round(Dimensions.get("window").height * 0.46);
const SORT_LABEL: Record<FeedSort, string> = { latest: "최신순", popular: "인기순" };
const TAB_LABEL: Record<Tab, string> = {
  blog: "기업",
  topic: "카테고리",
  level: "난이도",
  sort: "정렬",
};
const ALL_BLOGS = "전체 기업";

export interface FilterValue {
  blogIds: Set<string>; // 비어 있으면 전체 기업(다중 선택)
  topics: Set<Topic>;
  /** 개발 지식 난도 — "개발 몰라도 읽히는 글만" 을 골라 볼 수 있어야 한다. */
  levels: Set<ArticleLevel>;
  sort: FeedSort;
}

/** 화면 진입 기본값(필터 없음). */
export const emptyFilter = (): FilterValue => ({
  blogIds: new Set<string>(),
  topics: new Set<Topic>(),
  levels: new Set<ArticleLevel>(),
  sort: "latest",
});

export function FilterSheet({
  blogs,
  value,
  onChange,
  eyebrow = "지금 보는 곳",
  right,
  variant = "hero",
  sortLabels = SORT_LABEL,
}: {
  blogs: BlogRow[];
  value: FilterValue;
  onChange: (v: FilterValue) => void;
  /** 큰 기업명 위 작은 안내 문구("여기는" 자리). hero 에서만 쓰인다. */
  eyebrow?: string;
  /** 큰 헤더 우측에 놓을 액션(검색 아이콘 등). hero 에서만 쓰인다. */
  right?: React.ReactNode;
  /** hero: 큰 기업 드롭다운 + [카테고리][정렬] / chips: [기업][카테고리][정렬] / sort: [정렬]만. */
  variant?: "hero" | "chips" | "sort";
  /** 정렬 라벨 갈아끼우기 — 커뮤니티는 "인기순" 대신 "이야기 많은 순". */
  sortLabels?: Record<FeedSort, string>;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const insets = useSafeAreaInsets();
  const sortOnly = variant === "sort";
  const chipsOnly = variant === "chips" || sortOnly; // 히어로 카드를 안 그린다는 뜻
  const TABS: Tab[] = sortOnly
    ? ["sort"]
    : variant === "chips"
      ? ["blog", "topic", "level", "sort"]
      : ["topic", "level", "sort"];
  const [brandOpen, setBrandOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>(sortOnly ? "sort" : chipsOnly ? "blog" : "topic");
  // 시트 안 임시 선택(적용 눌러야 반영).
  const [draft, setDraft] = useState<FilterValue>(value);
  // 기업 시트도 다중 선택이라 임시 선택 후 "적용"으로 반영한다.
  const [brandDraft, setBrandDraft] = useState<Set<string>>(value.blogIds);

  const picked = blogs.filter((b) => value.blogIds.has(b.id));
  // 0개=전체, 1개=기업명, 2개 이상="○○ 외 N곳"
  const brandName =
    picked.length === 0 ? ALL_BLOGS : picked.length === 1 ? picked[0].name : `${picked[0].name} 외 ${picked.length - 1}곳`;
  const topicLabel = value.topics.size === 0 ? "카테고리" : `카테고리 ${value.topics.size}`;
  // 하나만 고르면 라벨을 그대로 보여준다 — "개발 지식 1" 보다 "누구나 이해 가능" 이 훨씬 명확하다.
  const levelLabel =
    value.levels.size === 0
      ? "난이도"
      : value.levels.size === 1
        ? LEVEL_META[[...value.levels][0]].label
        : `난이도 ${value.levels.size}`;
  const blogLabel = value.blogIds.size === 0 ? "기업" : `기업 ${value.blogIds.size}`;

  // 인사 배너용 — 이름 + 지금 보는 기업의 전체 글 수(카테고리 필터와 무관).
  const myName = useProfile().data?.name?.trim() || "게스트";
  const brandFilter = useMemo(
    () => (value.blogIds.size > 0 ? { blogIds: [...value.blogIds] } : {}),
    [value.blogIds],
  );
  const brandTotal = useArticlesFeedCount(brandFilter).data;

  const openBrand = () => {
    setBrandDraft(new Set(value.blogIds));
    setBrandOpen(true);
  };
  const applyBrand = () => {
    onChange({
      ...value,
      blogIds: new Set(brandDraft),
      topics: new Set(value.topics),
      levels: new Set(value.levels),
    });
    setBrandOpen(false);
  };
  const toggleBrand = (blogId: string) =>
    setBrandDraft((p) => {
      const n = new Set(p);
      if (n.has(blogId)) n.delete(blogId);
      else n.add(blogId);
      return n;
    });

  const openAt = (t: Tab) => {
    setDraft({
      blogIds: new Set(value.blogIds),
      topics: new Set(value.topics),
      levels: new Set(value.levels),
      sort: value.sort,
    });
    setTab(t);
    setOpen(true);
  };
  const apply = () => {
    // chips 변형에선 기업도 이 시트에서 고르므로 draft 를 그대로 반영한다.
    onChange({
      blogIds: new Set(chipsOnly ? draft.blogIds : value.blogIds),
      topics: new Set(draft.topics),
      levels: new Set(draft.levels),
      sort: draft.sort,
    });
    setOpen(false);
  };
  const reset = () =>
    setDraft((p) => ({
      blogIds: chipsOnly ? new Set<string>() : p.blogIds,
      topics: new Set<Topic>(),
      levels: new Set<ArticleLevel>(),
      sort: "latest",
    }));

  const toggleLevel = (lv: ArticleLevel) =>
    setDraft((p) => {
      const n = new Set(p.levels);
      if (n.has(lv)) n.delete(lv);
      else n.add(lv);
      return { ...p, levels: n };
    });
  const toggleTopic = (t: Topic) =>
    setDraft((p) => {
      const n = new Set(p.topics);
      if (n.has(t)) n.delete(t);
      else n.add(t);
      return { ...p, topics: n };
    });
  const toggleDraftBlog = (blogId: string) =>
    setDraft((p) => {
      const n = new Set(p.blogIds);
      if (n.has(blogId)) n.delete(blogId);
      else n.add(blogId);
      return { ...p, blogIds: n };
    });

  // 시트의 "N개 글 보기" 실시간 개수(기업 + 임시 카테고리 기준).
  const countBlogIds = chipsOnly ? draft.blogIds : value.blogIds;
  const draftFilter = useMemo(
    () => ({
      ...(draft.topics.size > 0 ? { topics: [...draft.topics] } : {}),
      ...(countBlogIds.size > 0 ? { blogIds: [...countBlogIds] } : {}),
    }),
    [draft.topics, countBlogIds],
  );
  const draftCount = useArticlesFeedCount(draftFilter).data;

  return (
    <>
      {/* ① 상단 유틸 아이콘(카드 바깥) — hero 전용 */}
      {!chipsOnly && right ? <View style={styles.utilBar}>{right}</View> : null}

      {/* ② 히어로 카드 — 기업 드롭다운이 카드 안쪽 주요 텍스트 (hero 전용) */}
      {!chipsOnly ? (
        <View style={[styles.hero, { backgroundColor: c.surfaceSunken }]}>
          <View style={styles.heroTop}>
            <Pressable style={styles.brandSelect} onPress={openBrand} hitSlop={6}>
              <Text style={[styles.eyebrow, { color: c.textMuted }]}>{eyebrow}</Text>
              <View style={styles.brandLine}>
                <Text style={[styles.brandName, { color: c.textPrimary }]} numberOfLines={1}>
                  {brandName}
                </Text>
                <ChevronDown size={26} color={c.textPrimary} />
              </View>
            </Pressable>
            {picked.length === 1 ? (
              <ServiceLogo
                name={picked[0].name}
                brandColor={picked[0].brand_color}
                homepage={picked[0].homepage}
                blogKey={picked[0].key}
                size={52}
              />
            ) : null}
          </View>

          {/* 인사 배너 */}
          <View style={[styles.banner, { backgroundColor: c.primary }]}>
            <Text style={[styles.bannerTop, { color: c.actionOn }]} numberOfLines={1}>
              {myName}님 안녕하세요!
            </Text>
            <Text style={[styles.bannerMain, { color: c.actionOn }]} numberOfLines={2}>
              {picked.length === 0 ? "테크 블로그 " : `${brandName}의 `}
              글 {brandTotal != null ? brandTotal.toLocaleString() : "-"}개를 모았어요.
            </Text>
          </View>
        </View>
      ) : null}

      {/* 기업 전환 바텀시트 — hero 의 큰 드롭다운 전용(chips 는 아래 필터 시트의 '기업' 탭 사용) */}
      <Modal visible={brandOpen} transparent animationType="slide" onRequestClose={() => setBrandOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setBrandOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: c.surfaceCard, paddingBottom: 16 + insets.bottom }]}
            onPress={() => {}}
          >
            <View style={styles.grip}>
              <View style={[styles.gripBar, { backgroundColor: c.hairline }]} />
            </View>
            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: c.textPrimary }]}>
                어떤 기업을 볼까요?
                {brandDraft.size > 0 ? ` (${brandDraft.size})` : ""}
              </Text>
              <Pressable onPress={() => setBrandOpen(false)} hitSlop={10}>
                <X size={22} color={c.textMuted} />
              </Pressable>
            </View>
            <ScrollView style={{ maxHeight: SHEET_LIST_H }} showsVerticalScrollIndicator={false}>
              {/* 아무것도 체크 안 하면 전체 — "전체 기업" 행으로 한 번에 해제 */}
              <PickRow
                label={ALL_BLOGS}
                checked={brandDraft.size === 0}
                onPress={() => setBrandDraft(new Set())}
              />
              {blogs.map((b) => (
                <PickRow
                  key={b.id}
                  label={b.name}
                  checked={brandDraft.has(b.id)}
                  onPress={() => toggleBrand(b.id)}
                  left={
                    <ServiceLogo
                      name={b.name}
                      brandColor={b.brand_color}
                      homepage={b.homepage}
                      blogKey={b.key}
                      size={28}
                    />
                  }
                />
              ))}
            </ScrollView>

            <View style={[styles.footer, { borderTopColor: c.hairline }]}>
              <Pressable
                style={[styles.resetBtn, { borderColor: c.hairline }]}
                onPress={() => setBrandDraft(new Set())}
              >
                <RotateCcw size={16} color={c.textSecondary} />
                <Text style={[styles.resetText, { color: c.textSecondary }]}>초기화</Text>
              </Pressable>
              <Pressable style={[styles.applyBtn, { backgroundColor: c.primary }]} onPress={applyBrand}>
                <Text style={[styles.applyText, { color: c.actionOn }]}>
                  {brandDraft.size === 0 ? "전체 기업 보기" : `${brandDraft.size}개 기업 보기`}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ③ 드롭다운 필터 칩 — chips 변형이면 '기업'도 같은 칩으로 */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.chipScroll}
        contentContainerStyle={styles.chipBar}
      >
        {variant === "chips" ? (
          <FilterChip label={blogLabel} active={value.blogIds.size > 0} onPress={() => openAt("blog")} />
        ) : null}
        {sortOnly ? null : (
          <FilterChip label={topicLabel} active={value.topics.size > 0} onPress={() => openAt("topic")} />
        )}
        {sortOnly ? null : (
          <FilterChip label={levelLabel} active={value.levels.size > 0} onPress={() => openAt("level")} />
        )}
        <FilterChip
          label={sortLabels[value.sort]}
          active={value.sort !== "latest"}
          onPress={() => openAt("sort")}
        />
      </ScrollView>

      {/* 카테고리/정렬 바텀시트 */}
      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable
            style={[styles.sheet, { backgroundColor: c.surfaceCard, paddingBottom: 16 + insets.bottom }]}
            onPress={() => {}}
          >
            <View style={styles.grip}>
              <View style={[styles.gripBar, { backgroundColor: c.hairline }]} />
            </View>

            <View style={styles.sheetHead}>
              <Text style={[styles.sheetTitle, { color: c.textPrimary }]}>필터</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={10}>
                <X size={22} color={c.textMuted} />
              </Pressable>
            </View>

            {/* 탭 — 균등 폭 */}
            <View style={[styles.tabs, { borderBottomColor: c.hairline }]}>
              {TABS.map((t) => {
                const on = tab === t;
                const cnt =
                  t === "topic"
                    ? draft.topics.size
                    : t === "blog"
                      ? draft.blogIds.size
                      : t === "level"
                        ? draft.levels.size
                        : 0;
                return (
                  <Pressable key={t} style={styles.tab} onPress={() => setTab(t)}>
                    <Text style={[styles.tabText, { color: on ? c.textPrimary : c.textMuted }]}>
                      {TAB_LABEL[t]}
                      {cnt > 0 ? ` ${cnt}` : ""}
                    </Text>
                    {on ? <View style={[styles.tabBar, { backgroundColor: c.primary }]} /> : null}
                  </Pressable>
                );
              })}
            </View>

            {/* 선택한 항목 칩 — 탭해서 바로 해제 (chips 변형이면 기업도 함께) */}
            {draft.topics.size > 0 || (chipsOnly && draft.blogIds.size > 0) ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.pickedScroll}
                contentContainerStyle={styles.pickedBar}
              >
                {chipsOnly
                  ? blogs
                      .filter((b) => draft.blogIds.has(b.id))
                      .map((b) => (
                        <Pressable
                          key={`b:${b.id}`}
                          onPress={() => toggleDraftBlog(b.id)}
                          style={[styles.pickedChip, { backgroundColor: c.primaryTint, borderColor: c.primary }]}
                        >
                          <Text style={[styles.pickedText, { color: c.primary }]}>{b.name}</Text>
                          <X size={13} color={c.primary} />
                        </Pressable>
                      ))
                  : null}
                {TOPIC_ORDER.filter((t) => draft.topics.has(t)).map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => toggleTopic(t)}
                    style={[styles.pickedChip, { backgroundColor: c.primaryTint, borderColor: c.primary }]}
                  >
                    <Text style={[styles.pickedText, { color: c.primary }]}>{TOPIC_META[t].label}</Text>
                    <X size={13} color={c.primary} />
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}

            <ScrollView style={{ maxHeight: SHEET_LIST_H }} showsVerticalScrollIndicator={false}>
              {tab === "blog" && (
                <>
                  <PickRow
                    label={ALL_BLOGS}
                    checked={draft.blogIds.size === 0}
                    onPress={() => setDraft((p) => ({ ...p, blogIds: new Set<string>() }))}
                  />
                  {blogs.map((b) => (
                    <PickRow
                      key={b.id}
                      label={b.name}
                      checked={draft.blogIds.has(b.id)}
                      onPress={() => toggleDraftBlog(b.id)}
                      left={
                        <ServiceLogo
                          name={b.name}
                          brandColor={b.brand_color}
                          homepage={b.homepage}
                          blogKey={b.key}
                          size={28}
                        />
                      }
                    />
                  ))}
                </>
              )}
              {tab === "topic" &&
                TOPIC_ORDER.map((t) => (
                  <PickRow
                    key={t}
                    label={TOPIC_META[t].label}
                    checked={draft.topics.has(t)}
                    onPress={() => toggleTopic(t)}
                  />
                ))}
              {tab === "level" &&
                LEVEL_ORDER.map((lv) => (
                  <PickRow
                    key={lv}
                    label={LEVEL_META[lv].label}
                    sub={LEVEL_META[lv].hint}
                    checked={draft.levels.has(lv)}
                    onPress={() => toggleLevel(lv)}
                  />
                ))}
              {tab === "sort" &&
                (["latest", "popular"] as const).map((s) => (
                  <PickRow
                    key={s}
                    label={sortLabels[s]}
                    checked={draft.sort === s}
                    radio
                    onPress={() => setDraft((p) => ({ ...p, sort: s }))}
                  />
                ))}
            </ScrollView>

            {/* 하단: 초기화 + N개 글 보기 */}
            <View style={[styles.footer, { borderTopColor: c.hairline }]}>
              <Pressable style={[styles.resetBtn, { borderColor: c.hairline }]} onPress={reset}>
                <RotateCcw size={16} color={c.textSecondary} />
                <Text style={[styles.resetText, { color: c.textSecondary }]}>초기화</Text>
              </Pressable>
              <Pressable style={[styles.applyBtn, { backgroundColor: c.primary }]} onPress={apply}>
                <Text style={[styles.applyText, { color: c.actionOn }]}>
                  {draftCount != null ? `${draftCount.toLocaleString()}개 글 보기` : "글 보기"}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

function FilterChip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? c.primaryTint : c.surfaceCard, borderColor: active ? c.primary : c.hairline },
      ]}
    >
      <Text style={[styles.chipText, { color: active ? c.primary : c.textSecondary }]} numberOfLines={1}>
        {label}
      </Text>
      <ChevronDown size={15} color={active ? c.primary : c.textMuted} />
    </Pressable>
  );
}

/** 시트 옵션 행 — 체크(원형)가 맨 왼쪽, 그다음 로고/라벨. */
function PickRow({
  label,
  sub,
  checked,
  onPress,
  left,
  radio,
}: {
  label: string;
  /** 라벨 아래 한 줄 설명 — 난이도처럼 이름만으론 뜻이 안 서는 항목에 쓴다. */
  sub?: string | null;
  checked: boolean;
  onPress: () => void;
  left?: React.ReactNode;
  radio?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View
        style={[
          styles.mark,
          checked
            ? radio
              ? { borderColor: c.primary }
              : { backgroundColor: c.primary, borderColor: c.primary }
            : { borderColor: c.hairline },
        ]}
      >
        {checked ? (
          radio ? (
            <View style={[styles.radioDot, { backgroundColor: c.primary }]} />
          ) : (
            <Check size={14} color={c.actionOn} strokeWidth={3} />
          )
        ) : null}
      </View>
      {left}
      <View style={styles.rowTextWrap}>
        <Text
          style={[
            styles.rowLabel,
            { color: checked ? c.textPrimary : c.textSecondary, fontWeight: checked ? "700" : "500" },
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
        {sub ? (
          <Text style={[styles.rowSub, { color: c.textMuted }]} numberOfLines={1}>
            {sub}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // ① 상단 유틸 아이콘 줄 — 카드 위, 이미지의 우측 상단 아이콘 자리.
  utilBar: { flexDirection: "row", justifyContent: "flex-end", alignItems: "center", paddingHorizontal: 12 },

  // ② 히어로 카드 — 큰 기업명이 카드 여백 안쪽(위에서 한 칸 내려온 자리)에 놓인다.
  hero: { marginHorizontal: 16, borderRadius: 20, padding: 18, paddingTop: 20, gap: 16 },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  brandSelect: { flex: 1 },
  eyebrow: { ...dtype.bodyS, marginBottom: 2 },
  brandLine: { flexDirection: "row", alignItems: "center", gap: 4 },
  brandName: { ...dtype.display, maxWidth: W * 0.52 },

  banner: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, gap: 3 },
  bannerTop: { ...dtype.bodyS, fontWeight: "700", fontFamily: PRETENDARD["700"], opacity: 0.9 },
  bannerMain: { ...dtype.cardTitle, fontWeight: "700", fontFamily: PRETENDARD["700"] },

  // ③ 하위 필터 칩 — flexGrow:0 으로 세로로 눌리지 않게, 칩은 minHeight 로 글자 잘림 방지.
  //    ↳ 칩이 세로로 잘려 보이지 않게 위아래 여백을 넉넉히 준다(특히 하단).
  chipScroll: { flexGrow: 0 },
  chipBar: {
    paddingHorizontal: 16,
    // 히어로 카드 바로 밑에 칩이 붙어 있어 답답했다 → 위 24, 아래 16 으로 벌린다.
    paddingTop: 24,
    paddingBottom: 16,
    paddingRight: 24,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 14,
    paddingRight: 10,
    minHeight: 36,
  },
  chipText: { fontSize: 13, lineHeight: 20, fontWeight: "700", fontFamily: PRETENDARD["700"] },

  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  grip: { alignItems: "center", paddingTop: 10 },
  gripBar: { width: 40, height: 4, borderRadius: 2 },
  sheetHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  sheetTitle: { ...dtype.title, fontWeight: "800", fontFamily: PRETENDARD["800"] },

  tabs: { flexDirection: "row", borderBottomWidth: 1, marginTop: 6 },
  tab: { flex: 1, alignItems: "center", paddingVertical: 13 },
  tabText: { fontSize: 15, lineHeight: 21, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  tabBar: { position: "absolute", bottom: -1, left: 0, right: 0, height: 2.5, borderRadius: 2 },

  pickedScroll: { flexGrow: 0 },
  pickedBar: { paddingHorizontal: 20, paddingVertical: 10, gap: 6, alignItems: "center" },
  pickedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingLeft: 11,
    paddingRight: 8,
    minHeight: 30,
  },
  pickedText: { fontSize: 12.5, lineHeight: 18, fontWeight: "700", fontFamily: PRETENDARD["700"] },

  row: { flexDirection: "row", alignItems: "center", gap: 11, paddingVertical: 12, paddingHorizontal: 20 },
  rowTextWrap: { flex: 1, gap: 1 },
  rowLabel: { fontSize: 15, lineHeight: 21 },
  rowSub: { ...dtype.meta },
  mark: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  radioDot: { width: 11, height: 11, borderRadius: 6 },

  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  resetBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    minHeight: 50,
  },
  resetText: { fontSize: 14, lineHeight: 20, fontWeight: "700", fontFamily: PRETENDARD["700"] },
  applyBtn: { flex: 1, borderRadius: 12, alignItems: "center", justifyContent: "center", minHeight: 50 },
  applyText: { fontSize: 15, lineHeight: 21, fontWeight: "700", fontFamily: PRETENDARD["700"] },
});
