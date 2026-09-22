/**
 * 아카이브 탭 — 내가 만든 보관함을 한눈에(§34).
 *
 * 구성: 밀린 글 배너 → 완독률 카드 → 아카이브 그리드(2열).
 *   · 완독률의 분모는 **저장한 글**이다. 전체 글을 분모로 잡으면 영원히 0% 라 아무 동기도 안 된다.
 *   · 첫 타일은 항상 "모든 글" — 분류하지 않은 사람도 들어갈 곳이 있어야 한다.
 *   · 수정 모드에서는 타일에 삭제 버튼이 뜬다(평소엔 안 보인다 — 실수로 지우면 되돌릴 수 없다).
 */
import { useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Plus, Search, Settings, Trash2, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { archiveIcon, dtype, PRETENDARD } from "@/theme";
import {
  useArchives,
  useDeleteArchive,
  useArchivedIds,
  useProfile,
  useReadRate,
} from "@/data";
import { Loading } from "@/components";

export function ArchiveHomeScreen() {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const profile = useProfile();
  const archives = useArchives();
  const archivedIds = useArchivedIds();
  const rate = useReadRate();
  const del = useDeleteArchive();
  const [editing, setEditing] = useState(false);

  const name = profile.data?.name ?? "회원";
  const list = archives.data ?? [];
  const saved = archivedIds.data?.length ?? 0;

  /**
   * 완독률 — **하나라도 읽었을 때만** 띄운다.
   * 담기만 하고 아직 안 읽은 사람에게 "0/12 · 0%" 와 텅 빈 게이지를 보여주는 건
   * 시작도 전에 벌점을 주는 것이다(PRODUCT §0-3). 그때는 카드를 통째로 숨기고,
   * 대신 아래 아카이브 그리드가 "담아둔 게 여기 있다"를 말한다.
   * RPC 가 아직 없는 DB(§34 미적용)에서는 finished 를 알 수 없으므로 역시 숨긴다.
   */
  const stat = useMemo(() => {
    const r = rate.data;
    if (r && r.saved > 0 && r.finished > 0) return { saved: r.saved, finished: r.finished };
    return null;
  }, [rate.data]);
  const percent = stat ? Math.round((stat.finished / stat.saved) * 100) : 0;

  const confirmDelete = (id: string, label: string) => {
    Alert.alert("아카이브를 지울까요?", `"${label}" 아카이브만 지워지고 저장한 글은 남아요.`, [
      { text: "취소", style: "cancel" },
      { text: "지우기", style: "destructive", onPress: () => del.mutate(id) },
    ]);
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={[styles.logo, { color: c.textPrimary }]}>
            distill<Text style={{ color: c.primary }}>.</Text>
          </Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => nav.navigate("Search")} hitSlop={8} style={styles.iconBtn}>
            <Search size={20} color={c.textPrimary} />
          </Pressable>
          <Pressable onPress={() => nav.navigate("DisplaySettings")} hitSlop={8} style={styles.iconBtn}>
            <Settings size={20} color={c.textPrimary} />
          </Pressable>
        </View>

        {/* 밀린 글 배너 */}
        <Pressable
          style={[styles.banner, { backgroundColor: c.primary }]}
          onPress={() => nav.navigate("DistillTabs", { screen: "Feed" })}
        >
          <Text style={[styles.bannerText, { color: c.actionOn }]}>밀린 글을 확인해 보세요</Text>
          <X size={16} color={c.primaryOnDark} />
        </Pressable>

        {/* 완독률 */}
        {stat ? (
          <View style={[styles.rateCard, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}>
            <View style={styles.rateHead}>
              <Text style={[styles.rateTitle, { color: c.textPrimary }]}>{name}님의 완독률</Text>
              <View style={[styles.ratePill, { backgroundColor: c.surfaceSunken }]}>
                <Text style={[styles.ratePillText, { color: c.textSecondary }]}>저장한 글 기준</Text>
              </View>
            </View>
            <View style={styles.rateRow}>
              <Text style={[styles.rateNum, { color: c.textSecondary }]}>
                <Text style={{ color: c.primary, fontFamily: PRETENDARD["800"] }}>{stat.finished}</Text>
                /{stat.saved}
              </Text>
              <View style={{ flex: 1 }} />
              <Text style={[styles.ratePercent, { color: c.primary }]}>{percent}%</Text>
            </View>
            <View style={[styles.bar, { backgroundColor: c.surfaceSunken }]}>
              <View style={[styles.barFill, { backgroundColor: c.primary, width: `${percent}%` }]} />
            </View>
          </View>
        ) : null}

        {/* 아카이브 그리드 */}
        <View style={styles.sectionHead}>
          <Text style={[styles.sectionTitle, { color: c.primary }]}>{name}님의 아카이브</Text>
          <View style={{ flex: 1 }} />
          <Pressable onPress={() => setEditing((v) => !v)} hitSlop={8}>
            <Text style={[styles.sectionAction, { color: c.textMuted }]}>{editing ? "완료" : "수정"}</Text>
          </Pressable>
        </View>

        {archives.isLoading ? (
          <Loading label="불러오는 중…" />
        ) : (
          <View style={styles.grid}>
            {/* 모든 글 — 분류하지 않은 사람의 기본 입구 */}
            <Pressable
              style={[styles.tile, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
              onPress={() => nav.navigate("ArchiveDetail", { archiveId: null, name: "모든 글" })}
            >
              <Text style={[styles.tileName, { color: c.textPrimary }]}>모든 글</Text>
              <Text style={[styles.tileCount, { color: c.primary }]}>
                {saved > 0 ? `${saved}개` : "비어 있어요"}
              </Text>
              <View style={[styles.tileIcon, { backgroundColor: archiveIcon("all").tint }]}>
                <Text style={[styles.tileIconText, { color: archiveIcon("all").ink }]}>ALL</Text>
              </View>
            </Pressable>

            {list.map((a) => {
              const meta = archiveIcon(a.icon);
              const Icon = meta.icon;
              return (
                <Pressable
                  key={a.id}
                  style={[styles.tile, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
                  onPress={() =>
                    editing
                      ? nav.navigate("CreateArchive", { archiveId: a.id })
                      : nav.navigate("ArchiveDetail", { archiveId: a.id, name: a.name })
                  }
                >
                  <Text style={[styles.tileName, { color: c.textPrimary }]} numberOfLines={1}>
                    {a.name}
                  </Text>
                  <Text style={[styles.tileCount, { color: c.primary }]}>
                    {a.count > 0 ? `${a.count}개` : "비어 있어요"}
                  </Text>
                  <View style={[styles.tileIcon, { backgroundColor: meta.tint }]}>
                    <Icon size={20} color={meta.ink} strokeWidth={2.2} />
                  </View>
                  {editing ? (
                    <Pressable
                      style={[styles.del, { backgroundColor: c.danger }]}
                      onPress={() => confirmDelete(a.id, a.name)}
                      hitSlop={6}
                    >
                      <Trash2 size={13} color="#fff" />
                    </Pressable>
                  ) : null}
                </Pressable>
              );
            })}

            {/* 만들기 타일 — 그리드 안에 있어야 "여기서 늘린다"가 보인다 */}
            <Pressable
              style={[styles.addTile, { borderColor: c.accentTintBorder, backgroundColor: c.primaryTint }]}
              onPress={() => nav.navigate("CreateArchive", {})}
            >
              <Plus size={22} color={c.primary} />
              <Text style={[styles.addText, { color: c.primary }]}>아카이브 추가</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { padding: 16, paddingBottom: 32, gap: 14 },

  header: { flexDirection: "row", alignItems: "center", gap: 2 },
  logo: { fontSize: 20, fontWeight: "800", fontFamily: PRETENDARD["800"], letterSpacing: -0.4 },
  iconBtn: { width: 36, height: 36, alignItems: "center", justifyContent: "center" },

  banner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  bannerText: { ...dtype.cardTitle, fontSize: 14.5, flex: 1 },

  rateCard: { borderWidth: 1, borderRadius: 18, padding: 16, gap: 10 },
  rateHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  rateTitle: { ...dtype.cardTitle },
  ratePill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  ratePillText: { ...dtype.meta, fontSize: 11 },
  rateRow: { flexDirection: "row", alignItems: "flex-end" },
  rateNum: { ...dtype.title, fontSize: 17 },
  ratePercent: { fontSize: 26, fontWeight: "800", fontFamily: PRETENDARD["800"] },
  bar: { height: 8, borderRadius: 4, overflow: "hidden" },
  barFill: { height: 8, borderRadius: 4 },

  sectionHead: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  sectionTitle: { ...dtype.title },
  sectionAction: { ...dtype.label, fontSize: 13 },

  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  tile: {
    width: "47.5%",
    flexGrow: 1,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    minHeight: 92,
    gap: 2,
  },
  tileName: { ...dtype.cardTitle, fontSize: 15 },
  tileCount: { ...dtype.meta, fontSize: 11.5 },
  tileIcon: {
    position: "absolute",
    right: 12,
    bottom: 12,
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  tileIconText: { fontSize: 11, fontWeight: "800", fontFamily: PRETENDARD["800"] },
  del: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  addTile: {
    width: "47.5%",
    flexGrow: 1,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 16,
    minHeight: 92,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  addText: { ...dtype.label, fontSize: 12.5 },
});
