import { useEffect, useMemo, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { RouteProp } from "@react-navigation/native";
import { ArrowUp, ChevronLeft, MessageSquare, MoreHorizontal, Pencil, Pin, Reply, Send, Sparkles, ThumbsUp, Trash2, X } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { useUid } from "@/auth/AuthProvider";
import { qk } from "@/lib/queryKeys";
import {
  useDiscussion,
  useSetConclusion,
  useDeleteDiscussion,
  useFetchDiscussionArticle,
  useRequestDiscussionContentSummary,
  useRequestDiscussionResultSummary,
  type DiscussionDetailData,
} from "@/data/discussions";
import { useStudy } from "@/data/studies";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
  type CommentWithAuthor,
} from "@/data/comments";
import { useLikeInfo, useToggleLike } from "@/data/likes";
import { AiSummary, Avatar, CommentSortSeg, ErrorState, LinkArticle, Loading, Menu, Tag } from "@/components";
import { useConfirm } from "@/providers/ConfirmProvider";
import { timeAgo } from "@/lib/date";
import { looksLikeStaleArticle } from "@/lib/text";
import { threadComments, type CommentSort } from "@/lib/sortComments";

type R = RouteProp<RootStackParamList, "DiscussionDetail">;

interface ReplyTarget {
  id: string;
  author: string;
  text: string;
}

export function DiscussionDetailScreen({ route }: { route: R }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const nav = useRootNav();
  const uid = useUid();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const { studyId, discussionId } = route.params;
  const invalidateComments = () =>
    qc.invalidateQueries({ queryKey: qk.comments("discussion", discussionId) });

  const disc = useDiscussion(discussionId);
  const study = useStudy(studyId);
  const comments = useComments("discussion", discussionId);
  const createComment = useCreateComment("discussion", discussionId);
  const updateComment = useUpdateComment("discussion", discussionId);
  const deleteDiscussion = useDeleteDiscussion(studyId);
  const deleteComment = useDeleteComment("discussion", discussionId, studyId);
  const setConclusion = useSetConclusion(discussionId);
  const contentSummary = useRequestDiscussionContentSummary(discussionId);
  const resultSummary = useRequestDiscussionResultSummary(discussionId);
  const fetchArticle = useFetchDiscussionArticle(discussionId);
  const [articleTried, setArticleTried] = useState(false);

  // 상세 진입 시 링크 원문 본문 자동 로드(공유 글과 동일). 옛 잡음 저장본이면 재수집.
  useEffect(() => {
    const d = disc.data;
    const needsFetch = d && !d.article_text ? true : looksLikeStaleArticle(d?.article_text);
    if (d && d.url && needsFetch && !articleTried) {
      setArticleTried(true);
      fetchArticle.mutate(d.url);
    }
  }, [disc.data, articleTried, fetchArticle]);

  const [draft, setDraft] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);
  const [sort, setSort] = useState<CommentSort>("recent");
  const [refreshing, setRefreshing] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  function focusInput() {
    scrollRef.current?.scrollToEnd({ animated: true });
    inputRef.current?.focus();
  }

  async function onRefresh() {
    setRefreshing(true);
    await Promise.all([disc.refetch(), comments.refetch()]);
    setRefreshing(false);
  }

  function startEdit(cm: CommentWithAuthor) {
    setEditing({ id: cm.id, text: cm.text });
    setDraft(cm.text);
    setReplyTo(null);
  }
  const now = useMemo(() => new Date(), []);

  const isOwner = study.data?.owner_id === uid;
  const threaded = useMemo(
    () =>
      threadComments(
        (comments.data ?? []) as CommentWithAuthor[],
        sort,
        disc.data?.conclusion_comment_id ?? null,
      ),
    [comments.data, sort, disc.data?.conclusion_comment_id],
  );

  function send() {
    const text = draft.trim();
    if (!text) return;
    if (editing) {
      updateComment.mutate(
        { id: editing.id, text },
        { onSuccess: () => { setDraft(""); setEditing(null); } },
      );
      return;
    }
    createComment.mutate(
      { studyId, text, parentId: replyTo?.id ?? null, quote: replyTo?.text ?? null },
      { onSuccess: () => { setDraft(""); setReplyTo(null); } },
    );
  }

  async function onDeleteDiscussion() {
    const ok = await confirm({
      title: "토론 삭제",
      message: "이 토론을 삭제할까요? 되돌릴 수 없어요.",
      confirmText: "삭제",
      destructive: true,
    });
    if (ok) deleteDiscussion.mutate(discussionId, { onSuccess: () => nav.goBack() });
  }

  async function onDeleteComment(id: string) {
    const ok = await confirm({
      title: "의견 삭제",
      message: "이 의견을 삭제할까요?",
      confirmText: "삭제",
      destructive: true,
    });
    if (ok) deleteComment.mutate(id);
  }

  if (disc.isLoading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: c.surfaceCard }]}>
        <Loading />
      </SafeAreaView>
    );
  }
  if (disc.isError || !disc.data) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: c.surfaceCard }]}>
        <ErrorState message={disc.error?.message} onRetry={() => disc.refetch()} />
      </SafeAreaView>
    );
  }

  const d: DiscussionDetailData = disc.data;
  const openerName = d.author?.name || "주최자";
  const openerRole = d.author?.role_title || "스터디";
  const openingText = d.body || d.prompt || "";
  const canDeleteDiscussion = d.author_id === uid || isOwner;
  const canEditDiscussion = d.author_id === uid;

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.surfaceCard }]} edges={["top"]}>
      {/* 스레드 헤더 */}
      <View style={[styles.header, { borderBottomColor: c.hairline }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.back}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: c.textMuted }]}>토론 · {d.week_label}</Text>
          <Text style={[styles.headerTitle, { color: c.textPrimary }]} numberOfLines={2}>
            {d.title}
          </Text>
        </View>
        {canEditDiscussion || canDeleteDiscussion ? (
          <Menu
            items={[
              ...(canEditDiscussion
                ? [
                    {
                      label: "수정",
                      icon: <Pencil size={16} color={c.textMuted} />,
                      onPress: () =>
                        nav.navigate("CreateDiscussion", { studyId, editDiscussionId: discussionId }),
                    },
                  ]
                : []),
              ...(canDeleteDiscussion
                ? [
                    {
                      label: "삭제",
                      icon: <Trash2 size={16} color="#c0392b" />,
                      destructive: true,
                      onPress: onDeleteDiscussion,
                    },
                  ]
                : []),
            ]}
          >
            <View style={styles.back}>
              <MoreHorizontal size={22} color={c.textMuted} />
            </View>
          </Menu>
        ) : null}
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} />
          }
        >
          {/* 여는 메시지 */}
          <View style={styles.msg}>
            <Avatar name={openerName} size={36} square />
            <View style={{ flex: 1 }}>
              <View style={styles.metaLine}>
                <Text style={[styles.name, { color: c.textPrimary }]}>{openerName}</Text>
                <Tag label="주최" kind="host" />
                <Text style={[styles.meta, { color: c.textMuted }]}>
                  {openerRole} · {d.week_label}
                </Text>
              </View>

              {/* 여는 글(주제로 작성한 내용) — 최상단 */}
              {openingText
                ? openingText.split("\n").filter(Boolean).map((p, i) => (
                    <Text key={i} style={[styles.body, { color: c.textPrimary }]}>
                      {p}
                    </Text>
                  ))
                : null}

              {d.tags && d.tags.length > 0 ? (
                <View style={styles.tagRow}>
                  {d.tags.map((t) => (
                    <View key={t} style={[styles.tagChip, { backgroundColor: c.tintLavender }]}>
                      <Text style={[styles.tagChipText, { color: c.primary }]}>#{t}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              {/* 링크 원문 */}
              {d.url ? (
                <LinkArticle
                  url={d.url}
                  articleText={d.article_text}
                  ogDescription={d.og_description}
                  loading={fetchArticle.isPending || !articleTried}
                />
              ) : null}

              {/* 글 요약 — 원문 아래, 보라색 라인 안(3탭) */}
              <AiSummary
                title="글 요약"
                summaries={d.ai_summaries}
                onGenerate={(m) => contentSummary.mutate(m)}
                pending={contentSummary.isPending}
              />

              <View style={styles.openingActions}>
                <OpeningLikeButton studyId={studyId} discussionId={discussionId} />
              </View>
            </View>
          </View>

          {/* 답글 divider + 정렬(우측) */}
          <View style={styles.divider}>
            <Text style={[styles.dividerText, { color: c.textMuted }]}>
              답글 {comments.data?.length ?? 0}개
            </Text>
            <View style={[styles.dividerLine, { backgroundColor: c.hairline }]} />
            <CommentSortSeg value={sort} onChange={setSort} />
          </View>

          {comments.isLoading ? (
            <Loading />
          ) : (
            threaded.map(({ comment: cm, depth }) => (
              <CommentItem
                key={cm.id}
                comment={cm}
                studyId={studyId}
                now={now}
                depth={depth}
                isOwner={isOwner}
                pinned={d.conclusion_comment_id === cm.id}
                canEdit={cm.author_id === uid}
                canDelete={cm.author_id === uid || isOwner}
                onEdit={() => startEdit(cm)}
                onDelete={() => onDeleteComment(cm.id)}
                onLikeSettled={invalidateComments}
                onPin={() =>
                  setConclusion.mutate(d.conclusion_comment_id === cm.id ? null : cm.id)
                }
                onReply={() =>
                  setReplyTo({ id: cm.id, author: cm.author?.name ?? "멤버", text: cm.text })
                }
              />
            ))
          )}

          {/* 하단: 토론 요약(참여자 의견 + 고정 결론 종합) */}
          <View style={[styles.summaryBox, { borderColor: c.hairline }]}>
            <View style={[styles.summaryHead, { backgroundColor: c.tintLavender }]}>
              <Sparkles size={14} color={c.primary} />
              <Text style={[styles.summaryTitle, { color: c.primary }]}>토론 요약</Text>
              <Pressable
                onPress={() => resultSummary.mutate()}
                disabled={resultSummary.isPending}
                style={[styles.summaryBtn, { backgroundColor: c.primary, opacity: resultSummary.isPending ? 0.6 : 1 }]}
              >
                <Text style={styles.summaryBtnText}>
                  {resultSummary.isPending ? "요약 중…" : d.ai_summary ? "다시 요약" : "요약하기"}
                </Text>
              </Pressable>
            </View>
            <View style={{ padding: 12 }}>
              {d.ai_summary ? (
                d.ai_summary.split("\n").filter(Boolean).map((l, i) => (
                  <Text key={i} style={[styles.summaryLine, { color: c.textPrimary }]}>{l}</Text>
                ))
              ) : (
                <Text style={{ color: c.textMuted, fontSize: 12.5 }}>
                  참여자 의견과 방장이 고정한 결론을 종합해 요약해드려요.
                </Text>
              )}
            </View>
          </View>
        </ScrollView>

        {/* 플로팅: 최상단 이동 / 의견 달기 */}
        <View style={styles.fabWrap} pointerEvents="box-none">
          <Pressable
            onPress={() => scrollRef.current?.scrollTo({ y: 0, animated: true })}
            style={[styles.fab, { backgroundColor: c.surfaceCard, borderColor: c.hairline }]}
            hitSlop={4}
          >
            <ArrowUp size={20} color={c.textSecondary} />
          </Pressable>
          <Pressable
            onPress={focusInput}
            style={[styles.fab, styles.fabPrimary, { backgroundColor: c.primary }]}
            hitSlop={4}
          >
            <MessageSquare size={19} color="#fff" />
          </Pressable>
        </View>

        {/* 입력창 */}
        <View style={[styles.inputBar, { backgroundColor: c.surfaceCard, borderTopColor: c.hairline }]}>
          {editing ? (
            <View style={[styles.replyChip, { backgroundColor: c.tintLavender }]}>
              <Text style={[styles.replyChipText, { color: c.primary, fontWeight: "700" }]} numberOfLines={1}>
                의견 수정 중
              </Text>
              <Pressable onPress={() => { setEditing(null); setDraft(""); }} hitSlop={8}>
                <X size={16} color={c.textMuted} />
              </Pressable>
            </View>
          ) : replyTo ? (
            <View style={[styles.replyChip, { backgroundColor: c.tintLavender }]}>
              <Text style={[styles.replyChipText, { color: c.textSecondary }]} numberOfLines={1}>
                <Text style={{ color: c.primary, fontWeight: "700" }}>{replyTo.author}</Text>
                님에게 답글 · {replyTo.text}
              </Text>
              <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
                <X size={16} color={c.textMuted} />
              </Pressable>
            </View>
          ) : null}
          <View style={[styles.inputRow, { borderColor: c.hairline }]}>
            <TextInput
              ref={inputRef}
              value={draft}
              onChangeText={setDraft}
              placeholder={editing ? "의견 수정" : "의견 보내기"}
              placeholderTextColor={c.textMuted}
              multiline
              style={[styles.input, { color: c.textPrimary }]}
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim() || createComment.isPending}
              style={[styles.sendBtn, { backgroundColor: draft.trim() ? c.primary : c.canvasParchment }]}
            >
              <Send size={16} color={draft.trim() ? "#fff" : c.textMuted} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function OpeningLikeButton({ studyId, discussionId }: { studyId: string; discussionId: string }) {
  const { theme } = useTheme();
  const info = useLikeInfo("discussion", discussionId);
  const toggle = useToggleLike(studyId, "discussion", discussionId);
  const liked = info.data?.liked ?? false;
  return (
    <Pressable onPress={() => toggle.mutate(liked)} style={styles.likeBtn} hitSlop={6}>
      <ThumbsUp size={14} color={liked ? theme.colors.primary : theme.colors.textMuted} fill={liked ? theme.colors.primary : "transparent"} />
      <Text style={[styles.likeText, { color: liked ? theme.colors.primary : theme.colors.textMuted }]}>
        좋아요 {info.data?.count ?? 0}
      </Text>
    </Pressable>
  );
}

function CommentItem({
  comment,
  studyId,
  now,
  depth,
  isOwner,
  pinned,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onLikeSettled,
  onPin,
  onReply,
}: {
  comment: CommentWithAuthor;
  studyId: string;
  now: Date;
  depth: number;
  isOwner: boolean;
  pinned: boolean;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLikeSettled: () => void;
  onPin: () => void;
  onReply: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const info = useLikeInfo("comment", comment.id);
  const toggle = useToggleLike(studyId, "comment", comment.id);
  const liked = info.data?.liked ?? false;
  const name = comment.author?.name ?? "멤버";
  const role = comment.author?.role_title || "멤버";
  const isReply = depth > 0;

  return (
    <View
      style={[
        styles.msg,
        pinned && { backgroundColor: c.accentTint, borderRadius: 8 },
        isReply && styles.reply,
      ]}
    >
      <Avatar name={name} size={36} square />
      <View style={{ flex: 1 }}>
        {pinned ? (
          <Text style={[styles.pinnedLabel, { color: c.primary }]}>📌 방장이 고정한 결론</Text>
        ) : null}
        <View style={styles.commentHead}>
          <View style={[styles.metaLine, { flex: 1 }]}>
            <Text style={[styles.name, { color: c.textPrimary }]}>{name}</Text>
            <Text style={[styles.meta, { color: c.textMuted }]}>
              {role} · {timeAgo(comment.created_at, now)}
            </Text>
          </View>
          {canEdit || canDelete || isOwner ? (
            <Menu
              items={[
                ...(canEdit
                  ? [{ label: "수정", icon: <Pencil size={16} color={c.textMuted} />, onPress: onEdit }]
                  : []),
                ...(isOwner
                  ? [
                      {
                        label: pinned ? "결론 고정 해제" : "결론으로 고정",
                        icon: <Pin size={16} color={c.textMuted} />,
                        onPress: onPin,
                      },
                    ]
                  : []),
                ...(canDelete
                  ? [
                      {
                        label: "삭제",
                        icon: <Trash2 size={16} color="#c0392b" />,
                        destructive: true,
                        onPress: onDelete,
                      },
                    ]
                  : []),
              ]}
            >
              <View style={styles.menuBtn}>
                <MoreHorizontal size={17} color={c.textMuted} />
              </View>
            </Menu>
          ) : null}
        </View>
        <Text style={[styles.body, { color: c.textPrimary }]}>{comment.text}</Text>
        <View style={styles.commentActions}>
          <Pressable
            onPress={() => toggle.mutate(liked, { onSettled: onLikeSettled })}
            style={styles.likeBtn}
            hitSlop={6}
          >
            <ThumbsUp size={14} color={liked ? c.primary : c.textMuted} fill={liked ? c.primary : "transparent"} />
            <Text style={[styles.likeText, { color: liked ? c.primary : c.textMuted }]}>
              좋아요 {info.data?.count ?? 0}
            </Text>
          </Pressable>
          {!isReply ? (
            <Pressable onPress={onReply} style={styles.likeBtn} hitSlop={6}>
              <Reply size={14} color={c.textMuted} />
              <Text style={[styles.likeText, { color: c.textMuted }]}>답글</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  openingActions: { flexDirection: "row", gap: 14, alignItems: "center", marginTop: 8 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: 14,
    borderBottomWidth: 1,
  },
  back: { width: 32, height: 32, alignItems: "center", justifyContent: "center" },
  kicker: { fontSize: 11.5, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase" },
  headerTitle: { fontSize: 19, fontWeight: "700", letterSpacing: -0.3, marginTop: 2 },
  scroll: { padding: 6, paddingBottom: 96 },
  msg: { flexDirection: "row", gap: 8, padding: 10, borderRadius: 8 },
  reply: { marginLeft: 24, paddingLeft: 10 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 90 },
  tagChipText: { fontSize: 12, fontWeight: "700" },
  metaLine: { flexDirection: "row", alignItems: "baseline", gap: 7, flexWrap: "wrap" },
  name: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 12 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 3 },
  pinnedLabel: { fontSize: 11, fontWeight: "700", marginBottom: 3 },
  linkCard: { marginTop: 8 },
  linkTitle: { fontSize: 15, fontWeight: "700", lineHeight: 20, marginBottom: 6 },
  linkBtn: { alignSelf: "flex-start", marginTop: 4, paddingVertical: 7, paddingHorizontal: 14, borderRadius: 90 },
  linkBtnText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 2 },
  likeText: { fontSize: 12.5, fontWeight: "600" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 10, paddingBottom: 4 },
  dividerText: { fontSize: 12.5, fontWeight: "700" },
  dividerLine: { flex: 1, height: 1 },
  summaryBox: { marginTop: 4, marginHorizontal: 10, borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 7, padding: 10 },
  summaryTitle: { fontSize: 13, fontWeight: "700", flex: 1 },
  summaryBtn: { borderRadius: 90, paddingVertical: 5, paddingHorizontal: 12 },
  summaryBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  summaryLine: { fontSize: 13.5, lineHeight: 21, marginTop: 4 },
  quote: { marginVertical: 6, paddingLeft: 9, borderLeftWidth: 3 },
  quoteText: { fontSize: 13, lineHeight: 19 },
  commentHead: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  menuBtn: { padding: 2, marginTop: -2 },
  commentActions: { flexDirection: "row", gap: 14, marginTop: 8, alignItems: "center" },
  fabWrap: { position: "absolute", right: 14, bottom: 76, gap: 10, alignItems: "center" },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  fabPrimary: { borderWidth: 0 },
  inputBar: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 10, borderTopWidth: 1 },
  replyChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 6,
  },
  replyChipText: { flex: 1, fontSize: 12.5 },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    borderWidth: 1,
    borderRadius: 10,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 6,
  },
  input: { flex: 1, fontSize: 15, lineHeight: 20, maxHeight: 110, paddingVertical: 4 },
  sendBtn: { width: 30, height: 30, borderRadius: 7, alignItems: "center", justifyContent: "center" },
});
