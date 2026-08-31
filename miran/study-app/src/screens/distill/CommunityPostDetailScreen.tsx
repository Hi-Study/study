// distill 커뮤니티 자유글 상세 — 제목 + 내용 + 좋아요 + 댓글/대댓글.
//   (댓글 스레드는 인사이트와 같은 CommentThread 컴포넌트를 target 만 바꿔 재사용.)
import React from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { ChevronLeft, Trash2 } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useUid } from "@/auth/AuthProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { useCommunityPost, useDeleteCommunityPost } from "@/data";
import { dtype } from "@/theme";
import { Avatar } from "@/components/Avatar";
import { relativeDate } from "@/components/distill/ArticleCards";
import { CommentThread } from "@/components/distill/OpinionThread";
import { InsightBody, type InsightData } from "@/components/distill/InsightBody";
import { Loading, ErrorState } from "@/components";

type Props = NativeStackScreenProps<RootStackParamList, "CommunityPostDetail">;

export function CommunityPostDetailScreen({ route }: Props) {
  const { postId } = route.params;
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const uid = useUid();
  const q = useCommunityPost(postId);
  const del = useDeleteCommunityPost();

  const post = q.data;
  const isMine = Boolean(post?.author_id && post.author_id === uid);

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: c.surfacePage }]} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.iconBtn}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: c.textPrimary }]}>자유글</Text>
        {isMine ? (
          <Pressable
            onPress={() => del.mutate(postId, { onSuccess: () => nav.goBack() })}
            disabled={del.isPending}
            hitSlop={8}
            style={styles.iconBtn}
          >
            <Trash2 size={20} color={c.textMuted} />
          </Pressable>
        ) : (
          <View style={styles.iconBtn} />
        )}
      </View>

      {q.isLoading ? (
        <Loading label="불러오는 중…" />
      ) : q.isError || !post ? (
        <ErrorState onRetry={() => q.refetch()} />
      ) : (
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.author}>
              <Avatar name={post.author?.name ?? "게스트"} size={36} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.who, { color: c.textPrimary }]}>{post.author?.name ?? "게스트"}</Text>
                <Text style={[styles.date, { color: c.textMuted }]}>{relativeDate(post.created_at)}</Text>
              </View>
            </View>

            <Text style={[styles.title, { color: c.textPrimary }]}>{post.title}</Text>
            {post.body ? (
              <Text style={[styles.body, { color: c.textSecondary }]}>{post.body}</Text>
            ) : (post.insight as { core?: string })?.core ? (
              // 예전에 감상문 폼으로 쓴 글(레거시)
              <InsightBody insight={post.insight as InsightData} />
            ) : null}

            <View style={[styles.divider, { backgroundColor: c.hairline }]} />

            <CommentThread target={{ kind: "community", id: postId }} />
          </ScrollView>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 6,
  },
  iconBtn: { width: 44, height: 44, alignItems: "center", justifyContent: "center" },
  headerTitle: { ...dtype.title },

  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 12 },
  author: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 4 },
  who: { ...dtype.cardTitle, fontSize: 15 },
  date: { ...dtype.meta, marginTop: 1 },
  title: { ...dtype.titleL },
  body: { ...dtype.body, lineHeight: 25 },
  divider: { height: 1, marginTop: 8 },
});
