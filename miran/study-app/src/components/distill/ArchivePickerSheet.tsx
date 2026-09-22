/**
 * 아카이브 담기 시트 — 글을 어느 보관함에 넣을지 고른다(§34).
 *
 * 저장(북마크)과 분리한 이유는 archives.ts 주석에 적어뒀다. 여기서는 그 결과만 지킨다:
 *   · 담으면 저장도 된다(체크하면 북마크 아이콘도 켜진다).
 *   · 빼도 저장은 유지된다.
 * 보관함이 하나도 없으면 목록 대신 **만들기 안내**를 보여준다 — 빈 목록은 길이 막힌 화면이다.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Check, FolderPlus, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav } from "@/navigation/types";
import { archiveIcon, dtype } from "@/theme";
import { useArchives, useArchiveIdsOfArticle, useToggleArchived } from "@/data";

export function ArchivePickerSheet({
  articleId,
  visible,
  onClose,
}: {
  articleId: string;
  visible: boolean;
  onClose: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const archives = useArchives();
  const picked = useArchiveIdsOfArticle(articleId);
  const toggle = useToggleArchived(articleId);

  const list = archives.data ?? [];
  const inSet = new Set(picked.data ?? []);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surfaceCard }]}>
        <View style={[styles.grip, { backgroundColor: c.hairline }]} />
        <View style={styles.head}>
          <Text style={[styles.title, { color: c.textPrimary }]}>아카이브에 담기</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={c.textMuted} />
          </Pressable>
        </View>
        <Text style={[styles.hint, { color: c.textMuted }]}>담으면 저장함에도 함께 들어가요.</Text>

        {list.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: c.textSecondary }]}>
              아직 만든 아카이브가 없어요.
            </Text>
            <Pressable
              style={[styles.createBtn, { backgroundColor: c.primary }]}
              onPress={() => {
                onClose();
                nav.navigate("CreateArchive", {});
              }}
            >
              <FolderPlus size={16} color={c.actionOn} />
              <Text style={[styles.createText, { color: c.actionOn }]}>아카이브 만들기</Text>
            </Pressable>
          </View>
        ) : (
          <ScrollView style={styles.list} contentContainerStyle={styles.listInner}>
            {list.map((a) => {
              const meta = archiveIcon(a.icon);
              const Icon = meta.icon;
              const on = inSet.has(a.id);
              return (
                <Pressable
                  key={a.id}
                  style={[
                    styles.row,
                    { borderColor: on ? c.primary : c.hairline, backgroundColor: on ? c.primaryTint : c.surfaceCard },
                  ]}
                  onPress={() => toggle.mutate({ archiveId: a.id, on: !on })}
                >
                  <View style={[styles.tile, { backgroundColor: meta.tint }]}>
                    <Icon size={17} color={meta.ink} strokeWidth={2.2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: c.textPrimary }]} numberOfLines={1}>
                      {a.name}
                    </Text>
                    <Text style={[styles.count, { color: c.textMuted }]}>{a.count}개</Text>
                  </View>
                  {on ? <Check size={18} color={c.primary} /> : null}
                </Pressable>
              );
            })}

            <Pressable
              style={[styles.addRow, { borderColor: c.hairline }]}
              onPress={() => {
                onClose();
                nav.navigate("CreateArchive", {});
              }}
            >
              <FolderPlus size={16} color={c.primary} />
              <Text style={[styles.addText, { color: c.primary }]}>새 아카이브 만들기</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 28,
    maxHeight: "72%",
  },
  grip: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, marginBottom: 10 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { ...dtype.title },
  hint: { ...dtype.bodyS, marginTop: 2, marginBottom: 12 },
  list: { flexGrow: 0 },
  listInner: { gap: 8, paddingBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 14, padding: 12 },
  tile: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  name: { ...dtype.cardTitle },
  count: { ...dtype.meta },
  addRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 14,
    paddingVertical: 14,
  },
  addText: { ...dtype.cardTitle, fontSize: 14 },
  empty: { alignItems: "center", gap: 12, paddingVertical: 28 },
  emptyText: { ...dtype.body },
  createBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  createText: { ...dtype.cardTitle, fontSize: 14 },
});
