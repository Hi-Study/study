/**
 * 아카이브 상세 — 한 보관함 안의 글 목록(§34).
 *
 * `archiveId === null` 이면 **모든 글**(북마크 전체)을 본다. 분류하지 않은 사람도
 * 같은 화면을 쓰게 해서, 보관함을 만들어야만 쓸 수 있는 기능이 되지 않게 했다.
 *
 * 필터는 세 가지만 둔다: 찾기(제목) · 읽음 여부 · 카드 크기.
 *   주제·난이도 같은 필터는 피드가 이미 한다. 보관함은 "내가 넣어둔 것"을 다시 찾는 곳이라
 *   찾는 축이 다르다 — 여기서 막히는 건 대개 "읽었나 안 읽었나"다.
 */
import { useMemo, useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ArrowUpDown, ChevronDown, ChevronLeft, Search, Settings2 } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { archiveIcon, dtype } from "@/theme";
import { useAllArchivedArticles, useArchiveArticles, useArchives, useReadIds } from "@/data";
import { ArticleGridCard, ArticleRow, FeaturedCard } from "@/components/distill/ArticleCards";
import { SizeSlider, type CardSize } from "@/components/distill/SizeSlider";
import { EmptyState, Loading } from "@/components";
import type { ArticleWithBlog } from "@/data/articles";

// 2열 그리드 카드 폭 — 화면폭 − 좌우 여백(16×2) − 카드 사이 간격(12), 반으로.

type Props = NativeStackScreenProps<RootStackParamList, "ArchiveDetail">;
type ReadFilter = "all" | "read" | "unread";

const READ_LABEL: Record<ReadFilter, string> = { all: "전체", read: "읽음", unread: "안읽음" };

export function ArchiveDetailScreen({ route }: Props) {
  const { archiveId, name } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  // 2열 그리드 카드 폭 — 창 폭을 따라간다(모듈 최상위에서 한 번 읽으면 창 크기를 못 쫓아간다).
  const gridW = (useWindowDimensions().width - 32 - 12) / 2;

  const archives = useArchives();
  const inArchive = useArchiveArticles(archiveId ?? "");
  const allArchived = useAllArchivedArticles();
  const readIds = useReadIds();

  const [q, setQ] = useState("");
  const [readFilter, setReadFilter] = useState<ReadFilter>("all");
  const [newestFirst, setNewestFirst] = useState(true);
  const [size, setSize] = useState<CardSize>(0);
  const [sizeOpen, setSizeOpen] = useState(false);
  const [switchOpen, setSwitchOpen] = useState(false);

  const source = archiveId ? inArchive : allArchived;
  const loading = source.isLoading;
  const readSet = useMemo(() => new Set(readIds.data ?? []), [readIds.data]);

  const rows = useMemo(() => {
    let list: ArticleWithBlog[] = source.data ?? [];
    const key = q.trim().toLowerCase();
    if (key) {
      list = list.filter(
        (a) =>
          a.title.toLowerCase().includes(key) ||
          (a.summary ?? "").toLowerCase().includes(key) ||
          (a.blog?.name ?? "").toLowerCase().includes(key),
      );
    }
    if (readFilter !== "all") {
      const want = readFilter === "read";
      list = list.filter((a) => readSet.has(a.id) === want);
    }
    // 정렬 기준은 발행일 — 담은 순서가 아니라 "언제 쓰인 글인지"로 찾는 게 자연스럽다.
    const sorted = [...list].sort((x, y) => {
      const a = x.published_at ?? x.created_at;
      const b = y.published_at ?? y.created_at;
      return newestFirst ? (a < b ? 1 : -1) : a > b ? 1 : -1;
    });
    return sorted;
  }, [source.data, q, readFilter, readSet, newestFirst]);

  const open = (id: string) => nav.navigate("ArticleDetail", { articleId: id });

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top"]}>
      {/* 헤더 — 이름을 누르면 다른 아카이브로 바로 갈아탄다(뒤로 갔다 다시 들어오지 않게) */}
      <View style={styles.bar}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.iconBtn}>
          <ChevronLeft size={22} color={c.textPrimary} />
        </Pressable>
        <Pressable style={styles.barTitle} onPress={() => setSwitchOpen((v) => !v)}>
          <Text style={[styles.barName, { color: c.textPrimary }]} numberOfLines={1}>
            {name}
          </Text>
          <ChevronDown size={17} color={c.textMuted} />
        </Pressable>
        <Pressable
          onPress={() => archiveId && nav.navigate("CreateArchive", { archiveId })}
          hitSlop={8}
          style={styles.iconBtn}
        >
          {archiveId ? <Settings2 size={19} color={c.textMuted} /> : null}
        </Pressable>
      </View>

      {switchOpen ? (
        <View style={[styles.switcher, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
          <Pressable
            style={styles.switchRow}
            onPress={() => {
              setSwitchOpen(false);
              nav.replace("ArchiveDetail", { archiveId: null, name: "모든 글" });
            }}
          >
            <Text style={[styles.switchText, { color: c.textPrimary }]}>모든 글</Text>
          </Pressable>
          {(archives.data ?? []).map((a) => {
            const meta = archiveIcon(a.icon);
            const Icon = meta.icon;
            return (
              <Pressable
                key={a.id}
                style={styles.switchRow}
                onPress={() => {
                  setSwitchOpen(false);
                  nav.replace("ArchiveDetail", { archiveId: a.id, name: a.name });
                }}
              >
                <View style={[styles.switchIcon, { backgroundColor: meta.tint }]}>
                  <Icon size={14} color={meta.ink} strokeWidth={2.2} />
                </View>
                <Text style={[styles.switchText, { color: c.textPrimary }]}>{a.name}</Text>
                <View style={{ flex: 1 }} />
                <Text style={[styles.switchCount, { color: c.textMuted }]}>{a.count}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <FlatList
        data={rows}
        key={`size-${size}`} // 열 수가 바뀌면 FlatList 를 새로 그려야 한다
        numColumns={size === 1 ? 2 : 1}
        columnWrapperStyle={size === 1 ? styles.col : undefined}
        keyExtractor={(a) => a.id}
        renderItem={({ item }) =>
          size === 0 ? (
            <ArticleRow article={item} onPress={() => open(item.id)} thumbFirst />
          ) : size === 1 ? (
            <ArticleGridCard article={item} onPress={() => open(item.id)} width={gridW} />
          ) : (
            <FeaturedCard article={item} onPress={() => open(item.id)} />
          )
        }
        ItemSeparatorComponent={() => <View style={{ height: size === 0 ? 14 : 12 }} />}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <View style={styles.header}>
            <View style={[styles.search, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
              <Search size={16} color={c.textMuted} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="모아둔 글을 찾아줘"
                placeholderTextColor={c.textMuted}
                style={[styles.searchInput, { color: c.textPrimary }]}
                returnKeyType="search"
              />
            </View>

            <View style={styles.filterRow}>
              <Text style={[styles.total, { color: c.textSecondary }]}>전체 {rows.length}</Text>
              {(["all", "read", "unread"] as ReadFilter[]).map((f) => {
                const on = readFilter === f;
                return (
                  <Pressable
                    key={f}
                    onPress={() => setReadFilter(f)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: on ? c.textPrimary : c.surfaceCard,
                        borderColor: on ? c.textPrimary : c.hairline,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: on ? c.surfaceCard : c.textSecondary }]}>
                      {READ_LABEL[f]}
                    </Text>
                  </Pressable>
                );
              })}
              <View style={{ flex: 1 }} />
              <Pressable style={styles.sort} onPress={() => setNewestFirst((v) => !v)} hitSlop={6}>
                <ArrowUpDown size={13} color={c.textSecondary} />
                <Text style={[styles.sortText, { color: c.textSecondary }]}>
                  {newestFirst ? "최신순" : "오래된순"}
                </Text>
              </Pressable>
            </View>

            <Pressable onPress={() => setSizeOpen((v) => !v)} hitSlop={6}>
              <Text style={[styles.sizeToggle, { color: c.textMuted }]}>
                {sizeOpen ? "크기 조절 닫기" : "카드 크기 조절"}
              </Text>
            </Pressable>
            {sizeOpen ? (
              <SizeSlider value={size} onChange={setSize} hint="슬라이더를 움직여 사이즈를 조절해주세요" />
            ) : null}
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <Loading label="불러오는 중…" />
          ) : (
            <EmptyState
              title={q || readFilter !== "all" ? "조건에 맞는 글이 없어요" : "아직 담은 글이 없어요"}
              hint={
                q || readFilter !== "all"
                  ? "검색어나 필터를 바꿔보세요"
                  : "카드나 글 상세에서 담기를 눌러 모아보세요"
              }
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  bar: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, height: 48 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },
  barTitle: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4 },
  barName: { ...dtype.title, fontSize: 17 },

  switcher: {
    marginHorizontal: 16,
    borderWidth: 1,
    borderRadius: 14,
    paddingVertical: 4,
    marginBottom: 4,
  },
  switchRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 11 },
  switchIcon: { width: 24, height: 24, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  switchText: { ...dtype.cardTitle, fontSize: 14.5 },
  switchCount: { ...dtype.meta },

  list: { padding: 16, paddingBottom: 32 },
  col: { gap: 12 },
  header: { gap: 10, paddingBottom: 14 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  searchInput: { ...dtype.bodyS, flex: 1, padding: 0 },

  filterRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  total: { ...dtype.meta, marginRight: 2 },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: 11, paddingVertical: 5 },
  chipText: { ...dtype.label, fontSize: 12 },
  sort: { flexDirection: "row", alignItems: "center", gap: 4 },
  sortText: { ...dtype.meta },
  sizeToggle: { ...dtype.meta },
});
