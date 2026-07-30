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
import { ArrowUp, ChevronLeft, MessageSquare, MessagesSquare, MoreHorizontal, Pencil, Reply, Send, ThumbsUp, Trash2, X } from "lucide-react-native";
import { useQueryClient } from "@tanstack/react-query";

import { useTheme } from "@/providers/ThemeProvider";
import { useRootNav, type RootStackParamList } from "@/navigation/types";
import { useUid } from "@/auth/AuthProvider";
import { qk } from "@/lib/queryKeys";
import { useShareDetail, useRequestSummary, useDeleteShare, useFetchArticle, cacheArticleFromDevice, type ShareWithMeta } from "@/data/shares";
import { useStudy } from "@/data/studies";
import {
  useComments,
  useCreateComment,
  useDeleteComment,
  useUpdateComment,
  type CommentWithAuthor,
} from "@/data/comments";
import { useLikeInfo, useToggleLike } from "@/data/likes";
import { useDiscussVoteInfo, useToggleDiscussVote } from "@/data/discussVotes";
import { AiSummary, Avatar, CommentSortSeg, ErrorState, InsightView, LinkArticle, Loading, Menu } from "@/components";
import { useConfirm } from "@/providers/ConfirmProvider";
import { timeAgo } from "@/lib/date";
import { looksLikeStaleArticle, domainOf } from "@/lib/text";
import { fetchArticleOnDevice } from "@/lib/articleExtract";
import { hasInsight } from "@/lib/insight";
import { threadComments, type CommentSort } from "@/lib/sortComments";

type R = RouteProp<RootStackParamList, "ShareDetail">;

interface ReplyTarget {
  id: string;
  author: string;
  text: string;
}

export function ShareDetailScreen({ route }: { route: R }) {
  const { theme } = useTheme();
  const nav = useRootNav();
  const { studyId, shareId } = route.params;

  const uid = useUid();
  const qc = useQueryClient();
  const confirm = useConfirm();
  const invalidateComments = () =>
    qc.invalidateQueries({ queryKey: qk.comments("share", shareId) });
  const study = useStudy(studyId);
  const share = useShareDetail(shareId);
  const comments = useComments("share", shareId);
  const createComment = useCreateComment("share", shareId);
  const updateComment = useUpdateComment("share", shareId);
  const deleteShare = useDeleteShare(studyId);
  const deleteComment = useDeleteComment("share", shareId, studyId);
  const summarize = useRequestSummary(shareId);
  const fetchArticle = useFetchArticle(shareId);
  const [articleTried, setArticleTried] = useState(false);

  // 상세 진입 시 링크 원문 본문을 자동으로 불러온다(요약 버튼 없이도 전문 표시).
  // 본문이 없거나, 예전 방식으로 저장된 잡음 덩어리면 새 추출기로 자동 재수집한다.
  useEffect(() => {
    const d = share.data;
    const needsFetch = d && !d.article_text ? true : looksLikeStaleArticle(d?.article_text);
    if (d && d.kind !== "text" && d.url && needsFetch && !articleTried) {
      setArticleTried(true);
      fetchArticle.mutate(d.url);
    }
  }, [share.data, articleTried, fetchArticle]);

  // 서버(Edge)가 Cloudflare 데이터센터 IP 차단 등으로 본문을 못 가져오면,
  // 폰(일반 IP)에서 직접 원문을 받아 본문을 뽑는다. 작성자면 DB 에도 캐시(모두 공유 + 요약).
  const [deviceText, setDeviceText] = useState<string | null>(null);
  const [deviceTried, setDeviceTried] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  useEffect(() => {
    const d = share.data;
    if (!d || d.kind === "text" || !d.url) return;
    if (!articleTried || fetchArticle.isPending) return; // 서버 시도부터
    if (d.article_text || deviceTried) return; // 이미 본문 있거나 이미 시도함
    setDeviceTried(true);
    setDeviceLoading(true);
    const url = d.url;
    const isAuthor = d.author_id === uid;
    fetchArticleOnDevice(url)
      .then((r) => {
        if (!r.text) return;
        setDeviceText(r.text);
        if (isAuthor) {
          cacheArticleFromDevice(shareId, {
            article_text: r.text,
            og_description: r.excerpt ?? d.og_description,
            og_image: r.image ?? d.og_image,
            source: d.source ?? domainOf(url),
          })
            .then(() => qc.invalidateQueries({ queryKey: qk.share(shareId) }))
            .catch(() => undefined);
        }
      })
      .catch(() => undefined)
      .finally(() => setDeviceLoading(false));
  }, [share.data, articleTried, fetchArticle.isPending, deviceTried, uid, shareId, qc]);

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
    // 당겨서 새로고침 = 원문도 강제 재추출(캐시된 옛/실패 본문 갱신용). 기기 폴백도 재시도.
    const d = share.data;
    setDeviceTried(false);
    setDeviceText(null);
    const tasks: Promise<unknown>[] = [share.refetch(), comments.refetch()];
    if (d && d.kind !== "text" && d.url) tasks.push(fetchArticle.mutateAsync(d.url));
    await Promise.all(tasks);
    setRefreshing(false);
  }

  function startEdit(cm: CommentWithAuthor) {
    setEditing({ id: cm.id, text: cm.text });
    setDraft(cm.text);
    setReplyTo(null);
  }
  const now = useMemo(() => new Date(), []);

  const c = theme.colors;
  const threaded = useMemo(
    () => threadComments((comments.data ?? []) as CommentWithAuthor[], sort),
    [comments.data, sort],
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
      {
        onSuccess: () => {
          setDraft("");
          setReplyTo(null);
        },
      },
    );
  }

  if (share.isLoading) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: c.surfaceCard }]}>
        <Loading />
      </SafeAreaView>
    );
  }
  if (share.isError || !share.data) {
    return (
      <SafeAreaView style={[styles.flex, { backgroundColor: c.surfaceCard }]}>
        <ErrorState message={share.error?.message} onRetry={() => share.refetch()} />
      </SafeAreaView>
    );
  }

  const s: ShareWithMeta = share.data;
  const isText = s.kind === "text";
  const hasSharerInfo =
    hasInsight(s.insight) || Boolean(s.note && s.note.trim()) || (s.tags?.length ?? 0) > 0;
  const authorName = s.author?.name ?? "알 수 없음";
  const authorRole = s.author?.role_title || "멤버";
  const isOwner = study.data?.owner_id === uid;
  const canDeleteShare = s.author_id === uid || isOwner;
  const canEditShare = s.author_id === uid;

  async function onDeleteShare() {
    const ok = await confirm({
      title: "글 삭제",
      message: "이 글을 삭제할까요? 되돌릴 수 없어요.",
      confirmText: "삭제",
      destructive: true,
    });
    if (ok) deleteShare.mutate(shareId, { onSuccess: () => nav.goBack() });
  }

  async function onDeleteComment(id: string) {
    const ok = await confirm({
      title: "댓글 삭제",
      message: "이 댓글을 삭제할까요?",
      confirmText: "삭제",
      destructive: true,
    });
    if (ok) deleteComment.mutate(id);
  }

  return (
    <SafeAreaView style={[styles.flex, { backgroundColor: c.surfaceCard }]} edges={["top"]}>
      {/* 채널 헤더 */}
      <View style={[styles.header, { borderBottomColor: c.hairline }]}>
        <Pressable onPress={() => nav.goBack()} hitSlop={8} style={styles.back}>
          <ChevronLeft size={24} color={c.textPrimary} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: c.textMuted }]}>
            공유 글{isText ? " · 직접 작성" : ""}
          </Text>
          <Text style={[styles.headerTitle, { color: c.textPrimary }]} numberOfLines={2}>
            {s.title}
          </Text>
        </View>
        {canEditShare || canDeleteShare ? (
          <Menu
            items={[
              ...(canEditShare
                ? [
                    {
                      label: "수정",
                      icon: <Pencil size={16} color={c.textMuted} />,
                      onPress: () => nav.navigate("CreateShare", { studyId, editShareId: shareId }),
                    },
                  ]
                : []),
              ...(canDeleteShare
                ? [
                    {
                      label: "삭제",
                      icon: <Trash2 size={16} color="#c0392b" />,
                      destructive: true,
                      onPress: onDeleteShare,
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
          {/* 공유자 메시지 */}
          <View style={styles.msg}>
            <Avatar name={authorName} size={36} square />
            <View style={{ flex: 1 }}>
              <View style={styles.metaLine}>
                <Text style={[styles.name, { color: c.textPrimary }]}>{authorName}</Text>
                <Text style={[styles.meta, { color: c.textMuted }]}>
                  {authorRole} · 글을 공유했어요
                </Text>
              </View>

              {/* 직접 작성 글: 인사이트가 곧 본문 → 상단 */}
              {isText ? (
                <SharerInsight insight={s.insight} fallbackText={s.body} tags={s.tags} />
              ) : null}

              {/* 링크 원문 — 제목/URL/원문 먼저(위). 펼치면 그 원문에서 바로 문장 밑줄 가능 */}
              {!isText && s.url ? (
                <LinkArticle
                  url={s.url}
                  articleText={s.article_text ?? deviceText}
                  ogDescription={s.og_description}
                  loading={fetchArticle.isPending || !articleTried || deviceLoading}
                  highlight={{ shareId, studyId }}
                />
              ) : null}

              {/* AI 요약 — 본문 아래(원문요약/기획자관점/쉽게풀기 3탭) */}
              {!isText ? (
                <AiSummary
                  summaries={s.ai_summaries}
                  onGenerate={(m) => summarize.mutate(m)}
                  pending={summarize.isPending}
                />
              ) : null}

              {/* 링크 글: 공유자의 인사이트·태그는 원문/요약 아래(하단)에 */}
              {!isText && hasSharerInfo ? (
                <View style={styles.sharerBlock}>
                  <View style={styles.sharerDivider}>
                    <View style={[styles.dividerLine, { backgroundColor: c.hairline }]} />
                    <Text style={[styles.sharerLabel, { color: c.textMuted }]}>공유자의 인사이트</Text>
                    <View style={[styles.dividerLine, { backgroundColor: c.hairline }]} />
                  </View>
                  <SharerInsight insight={s.insight} fallbackText={s.note} tags={s.tags} />
                </View>
              ) : null}

              <View style={styles.openingActions}>
                <PostLikeButton studyId={studyId} shareId={shareId} />
                <DiscussButton studyId={studyId} shareId={shareId} />
              </View>

              {s.promoted_discussion_id ? (
                <Pressable
                  onPress={() =>
                    nav.navigate("DiscussionDetail", {
                      studyId,
                      discussionId: s.promoted_discussion_id!,
                    })
                  }
                  style={[styles.promotedBadge, { backgroundColor: c.tintLavender }]}
                >
                  <MessagesSquare size={14} color={c.primary} />
                  <Text style={[styles.promotedText, { color: c.primary }]}>
                    이 글이 토론으로 열렸어요 · 보러가기 ›
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>

          {/* 댓글 divider + 정렬(우측) */}
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
                canEdit={cm.author_id === uid}
                canDelete={cm.author_id === uid || isOwner}
                onEdit={() => startEdit(cm)}
                onDelete={() => onDeleteComment(cm.id)}
                onLikeSettled={invalidateComments}
                onReply={() =>
                  setReplyTo({ id: cm.id, author: cm.author?.name ?? "멤버", text: cm.text })
                }
              />
            ))
          )}
        </ScrollView>

        {/* 플로팅: 최상단 이동 / 댓글 달기 */}
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
                댓글 수정 중
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
              placeholder={editing ? "댓글 수정" : "댓글 보내기"}
              placeholderTextColor={c.textMuted}
              multiline
              style={[styles.input, { color: c.textPrimary }]}
            />
            <Pressable
              onPress={send}
              disabled={!draft.trim() || createComment.isPending}
              style={[
                styles.sendBtn,
                { backgroundColor: draft.trim() ? c.primary : c.canvasParchment },
              ]}
            >
              <Send size={16} color={draft.trim() ? "#fff" : c.textMuted} />
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** 공유자의 인사이트(구조화 회고) + 태그 묶음. 링크 글은 하단, 직접작성은 상단. */
function SharerInsight({
  insight,
  fallbackText,
  tags,
}: {
  insight: unknown;
  fallbackText: string | null;
  tags: string[] | null;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  return (
    <>
      <InsightView raw={insight} fallbackText={fallbackText} />
      {tags && tags.length > 0 ? (
        <View style={styles.tagRow}>
          {tags.map((t) => (
            <View key={t} style={[styles.tagChip, { backgroundColor: c.tintLavender }]}>
              <Text style={[styles.tagChipText, { color: c.primary }]}>#{t}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </>
  );
}

/** 공유 글 좋아요 토글(별도 컴포넌트 — 자체 like 훅). */
function PostLikeButton({ studyId, shareId }: { studyId: string; shareId: string }) {
  const { theme } = useTheme();
  const info = useLikeInfo("share", shareId);
  const toggle = useToggleLike(studyId, "share", shareId);
  const liked = info.data?.liked ?? false;
  return (
    <Pressable
      onPress={() => toggle.mutate(liked)}
      style={styles.likeBtn}
      hitSlop={6}
    >
      <ThumbsUp
        size={14}
        color={liked ? theme.colors.primary : theme.colors.textMuted}
        fill={liked ? theme.colors.primary : "transparent"}
      />
      <Text
        style={[
          styles.likeText,
          { color: liked ? theme.colors.primary : theme.colors.textMuted },
        ]}
      >
        좋아요 {info.data?.count ?? 0}
      </Text>
    </Pressable>
  );
}

/** "토론해요" 투표 — 그 주 최다(동률 전부) 글은 자동으로 토론 탭에 열린다. */
function DiscussButton({ studyId, shareId }: { studyId: string; shareId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const info = useDiscussVoteInfo(shareId);
  const toggle = useToggleDiscussVote(studyId, shareId);
  const voted = info.data?.voted ?? false;
  return (
    <Pressable onPress={() => toggle.mutate(voted)} style={styles.likeBtn} hitSlop={6}>
      <MessagesSquare size={14} color={voted ? c.primary : c.textMuted} />
      <Text style={[styles.likeText, { color: voted ? c.primary : c.textMuted }]}>
        토론해요 {info.data?.count ?? 0}
      </Text>
    </Pressable>
  );
}

/** 댓글 행 — 좋아요/답글 + ⋯(수정·삭제) 메뉴. depth=1 이면 답글(들여쓰기). */
function CommentItem({
  comment,
  studyId,
  now,
  depth,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  onLikeSettled,
  onReply,
}: {
  comment: CommentWithAuthor;
  studyId: string;
  now: Date;
  depth: number;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onLikeSettled: () => void;
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
    <View style={[styles.msg, isReply && styles.reply]}>
      <Avatar name={name} size={36} square />
      <View style={{ flex: 1 }}>
        <View style={styles.commentHead}>
          <View style={[styles.metaLine, { flex: 1 }]}>
            <Text style={[styles.name, { color: c.textPrimary }]}>{name}</Text>
            <Text style={[styles.meta, { color: c.textMuted }]}>
              {role} · {timeAgo(comment.created_at, now)}
            </Text>
          </View>
          {canEdit || canDelete ? (
            <Menu
              items={[
                ...(canEdit
                  ? [{ label: "수정", icon: <Pencil size={16} color={c.textMuted} />, onPress: onEdit }]
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
            <ThumbsUp
              size={14}
              color={liked ? c.primary : c.textMuted}
              fill={liked ? c.primary : "transparent"}
            />
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
  headerTitle: { fontSize: 18, fontWeight: "700", letterSpacing: -0.3, marginTop: 2 },
  scroll: { padding: 6, paddingBottom: 96 },
  msg: { flexDirection: "row", gap: 8, padding: 10, borderRadius: 8 },
  reply: { marginLeft: 24, paddingLeft: 10 },
  promotedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    alignSelf: "flex-start",
    marginTop: 8,
    borderRadius: 90,
    paddingVertical: 7,
    paddingHorizontal: 12,
  },
  promotedText: { fontSize: 12.5, fontWeight: "700" },
  sharerBlock: { marginTop: 14 },
  sharerDivider: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6 },
  sharerLabel: { fontSize: 12, fontWeight: "800", letterSpacing: 0.3 },
  tagRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  tagChip: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 90 },
  tagChipText: { fontSize: 12, fontWeight: "700" },
  metaLine: { flexDirection: "row", alignItems: "baseline", gap: 7, flexWrap: "wrap" },
  name: { fontSize: 15, fontWeight: "700" },
  meta: { fontSize: 12 },
  body: { fontSize: 15, lineHeight: 22, marginTop: 3 },
  linkCard: { marginTop: 10, paddingLeft: 12, borderLeftWidth: 4 },
  domainRow: { flexDirection: "row", alignItems: "center", gap: 5, marginBottom: 2 },
  domain: { fontSize: 12.5, fontWeight: "600", flex: 1 },
  linkDesc: { flex: 1, fontSize: 13.5, lineHeight: 20, marginTop: 6 },
  articleBody: { fontSize: 14.5, lineHeight: 23, marginTop: 8 },
  articleLoading: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  expandBtn: { marginTop: 8, alignSelf: "flex-start" },
  expandText: { fontSize: 13, fontWeight: "700" },
  linkBtn: {
    alignSelf: "flex-start",
    marginTop: 10,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 90,
  },
  linkBtnText: { color: "#fff", fontSize: 12.5, fontWeight: "700" },
  summaryBox: { marginTop: 10, borderWidth: 1, borderRadius: 10, overflow: "hidden" },
  summaryHead: { flexDirection: "row", alignItems: "center", gap: 7, padding: 10 },
  summaryTitle: { fontSize: 13, fontWeight: "700", flex: 1 },
  summaryBtn: { borderRadius: 90, paddingVertical: 5, paddingHorizontal: 12 },
  summaryBtnText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  summaryLine: { fontSize: 13.5, lineHeight: 21, marginTop: 4 },
  textBox: { marginTop: 8, padding: 14, borderWidth: 1, borderRadius: 10 },
  textBody: { fontSize: 14.5, lineHeight: 23, marginTop: 8 },
  likeBtn: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 2 },
  likeText: { fontSize: 12.5, fontWeight: "600" },
  divider: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingTop: 12, paddingBottom: 4 },
  dividerText: { fontSize: 12.5, fontWeight: "700" },
  dividerLine: { flex: 1, height: 1 },
  quote: { marginVertical: 6, paddingLeft: 9, borderLeftWidth: 3 },
  quoteText: { fontSize: 13, lineHeight: 19 },
  commentHead: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  menuBtn: { padding: 2, marginTop: -2 },
  commentActions: { flexDirection: "row", gap: 14, marginTop: 8 },
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
  sendBtn: {
    width: 30,
    height: 30,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
  },
});
