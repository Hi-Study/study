/**
 * 관심 기업 설정 시트 — 기업 목록에 별을 켜고 끈다.
 *
 * 왜 마이가 아니라 **기업을 보고 있는 자리**에 있나: 마이에 두면 "내 아카이브" 바로 옆에
 * 놓이는데, 아카이브는 이미 탭으로 있어서 같은 문이 두 개가 됐다. 그리고 관심 기업은
 * 내 기록이 아니라 **목록을 고르는 설정**이다. 기업 아이콘을 보다가 "얘 즐겨찾기" 하는
 * 흐름이 자연스럽다.
 *
 * 시트 규격은 DESIGN_SYSTEM §4.5 를 따른다.
 */
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Star, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { dtype } from "@/theme";
import { useBlogs, useFavoriteBlogIds, useToggleBlogFavorite } from "@/data";
import { ServiceLogo } from "@/components/distill/ArticleCards";

export function FavoriteBlogsSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const blogs = useBlogs().data ?? [];
  const favSet = new Set(useFavoriteBlogIds().data ?? []);
  const toggle = useToggleBlogFavorite();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { backgroundColor: c.surfaceCard }]}>
        <View style={[styles.grip, { backgroundColor: c.hairline }]} />
        <View style={styles.head}>
          <Text style={[styles.title, { color: c.textPrimary }]}>관심 기업</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <X size={20} color={c.textMuted} />
          </Pressable>
        </View>
        <Text style={[styles.hint, { color: c.textMuted }]}>
          즐겨찾기한 기업의 새 글이 홈에 따로 모여요.
        </Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {blogs.map((b) => {
            const on = favSet.has(b.id);
            return (
              <Pressable
                key={b.id}
                style={styles.row}
                onPress={() => toggle.mutate({ blogId: b.id, favorite: !on })}
              >
                <ServiceLogo
                  name={b.name}
                  brandColor={b.brand_color}
                  homepage={b.homepage}
                  blogKey={b.key}
                  size={32}
                />
                <Text style={[styles.name, { color: c.textPrimary }]}>{b.name}</Text>
                <Star size={20} color={on ? c.hot : c.textMuted} fill={on ? c.hot : "transparent"} />
              </Pressable>
            );
          })}
        </ScrollView>
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
  hint: { ...dtype.bodyS, marginTop: 2, marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  name: { ...dtype.cardTitle, flex: 1 },
});
