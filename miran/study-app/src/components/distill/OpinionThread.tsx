// distill 댓글 스레드(인라인 재사용) — 좋아요 + 댓글/**대댓글** + 본인 수정·삭제 + 입력.
//   인사이트(의견)와 커뮤니티 자유글이 같은 컴포넌트를 쓴다(target 으로 구분).
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { CornerDownRight, Heart, MessageSquare, Pencil, Send, Trash2, X } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useUid } from "@/auth/AuthProvider";
import {
  useThreadComments,
  useCreateThreadComment,
  useUpdateThreadComment,
  useDeleteThreadComment,
  useLiked,
  useToggleReaction,
  type CommentTarget,
  type OpinionCommentRow,
} from "@/data";
import { dtype } from "@/theme";
import { relativeDate } from "@/components/distill/ArticleCards";
import { Avatar } from "@/components/Avatar";

// 댓글 항목 — 본인 것은 수정/삭제. 대댓글(parent_id)은 들여쓰기.
export function CommentItem({
  comment,
  isMine,
  onUpdate,
  onDelete,
  onReply,
}: {
  comment: OpinionCommentRow;
  isMine: boolean;
  onUpdate: (text: string) => void;
  onDelete: () => void;
  /** 답글(대댓글) 달기 — 없으면 답글 버튼을 숨긴다. */
  onReply?: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const liked = useLiked("comment", comment.id);
  const toggleLike = useToggleReaction("comment", comment.id);

  return (
    <View style={[styles.comment, comment.parent_id ? styles.reply : null]}>
      {comment.parent_id ? <CornerDownRight size={14} color={c.textMuted} style={styles.replyIcon} /> : null}
      <Avatar name={comment.author?.name ?? "게스트"} size={30} />
      <View style={{ flex: 1 }}>
        <View style={styles.cmHead}>
          <Text style={[styles.cmWho, { color: c.textPrimary }]}>
            {comment.author?.name ?? "게스트"}
          </Text>
          <Text style={[styles.cmDate, { color: c.textMuted }]}>{relativeDate(comment.created_at)}</Text>
        </View>

        {editing ? (
          <View style={styles.editWrap}>
            <TextInput
              value={draft}
              onChangeText={setDraft}
              multiline
              autoFocus
              style={[
                styles.editInput,
                { color: c.textPrimary, borderColor: c.hairline, backgroundColor: c.surfaceSunken },
              ]}
            />
            <View style={styles.editActions}>
              <Pressable
                onPress={() => {
                  setEditing(false);
                  setDraft(comment.text);
                }}
              >
                <Text style={[styles.editBtn, { color: c.textMuted }]}>취소</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const t = draft.trim();
                  if (t) {
                    onUpdate(t);
                    setEditing(false);
                  }
                }}
              >
                <Text style={[styles.editBtn, { color: c.primary }]}>저장</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <Text style={[styles.cmText, { color: c.textSecondary }]}>{comment.text}</Text>
        )}

        {!editing ? (
          <View style={styles.cmActions}>
            <Pressable
              onPress={() => toggleLike.mutate(liked.data ?? false)}
              disabled={toggleLike.isPending}
              hitSlop={6}
              style={styles.cmAction}
            >
              <Heart
                size={13}
                color={liked.data ? c.danger : c.textMuted}
                fill={liked.data ? c.danger : "transparent"}
              />
              <Text style={[styles.cmActionText, { color: liked.data ? c.danger : c.textMuted }]}>
                좋아요
              </Text>
            </Pressable>
            {onReply ? (
              <Pressable onPress={onReply} hitSlop={6} style={styles.cmAction}>
                <CornerDownRight size={13} color={c.textMuted} />
                <Text style={[styles.cmActionText, { color: c.textMuted }]}>답글</Text>
              </Pressable>
            ) : null}
            {isMine ? (
              <>
                <Pressable onPress={() => setEditing(true)} hitSlop={6} style={styles.cmAction}>
                  <Pencil size={13} color={c.textMuted} />
                  <Text style={[styles.cmActionText, { color: c.textMuted }]}>수정</Text>
                </Pressable>
                <Pressable onPress={onDelete} hitSlop={6} style={styles.cmAction}>
                  <Trash2 size={13} color={c.textMuted} />
                  <Text style={[styles.cmActionText, { color: c.textMuted }]}>삭제</Text>
                </Pressable>
              </>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

/** 최상위 댓글 → 그 아래 대댓글 순으로 정렬(작성순). */
function threaded(rows: OpinionCommentRow[]): OpinionCommentRow[] {
  const roots = rows.filter((r) => !r.parent_id);
  const byParent = new Map<string, OpinionCommentRow[]>();
  for (const r of rows) {
    if (!r.parent_id) continue;
    const list = byParent.get(r.parent_id) ?? [];
    list.push(r);
    byParent.set(r.parent_id, list);
  }
  // 부모가 삭제된 고아 대댓글도 빠지지 않게 뒤에 붙인다.
  const seen = new Set<string>();
  const out: OpinionCommentRow[] = [];
  for (const r of roots) {
    out.push(r);
    seen.add(r.id);
    for (const child of byParent.get(r.id) ?? []) {
      out.push(child);
      seen.add(child.id);
    }
  }
  for (const r of rows) if (!seen.has(r.id)) out.push(r);
  return out;
}

/** 좋아요 + 댓글 스레드 + 입력(인라인). hideLike: 카드가 이미 좋아요를 보이면 숨김. */
export function CommentThread({
  target,
  hideLike,
}: {
  target: CommentTarget;
  hideLike?: boolean;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const uid = useUid();
  const commentsQ = useThreadComments(target);
  const createComment = useCreateThreadComment(target);
  const updateComment = useUpdateThreadComment(target);
  const deleteComment = useDeleteThreadComment(target);
  const likeTarget = target.kind === "opinion" ? "opinion" : "community";
  const liked = useLiked(likeTarget, target.id);
  const toggleLike = useToggleReaction(likeTarget, target.id);
  const [text, setText] = useState("");
  // 답글 대상(대댓글). null 이면 최상위 댓글.
  const [replyTo, setReplyTo] = useState<OpinionCommentRow | null>(null);

  const comments = threaded(commentsQ.data ?? []);
  const send = () => {
    const t = text.trim();
    if (!t) return;
    createComment.mutate(
      { text: t, parentId: replyTo?.parent_id ?? replyTo?.id ?? null },
      {
        onSuccess: () => {
          setText("");
          setReplyTo(null);
        },
      },
    );
  };

  return (
    <View style={styles.thread}>
      {!hideLike ? (
        <View style={styles.actionsRow}>
          <Pressable
            onPress={() => toggleLike.mutate(liked.data ?? false)}
            disabled={toggleLike.isPending}
            hitSlop={6}
            style={styles.actionBtn}
          >
            <Heart size={17} color={liked.data ? c.danger : c.textMuted} fill={liked.data ? c.danger : "transparent"} />
            <Text style={[styles.actionText, { color: liked.data ? c.danger : c.textSecondary }]}>좋아요</Text>
          </Pressable>
          <View style={styles.actionBtn}>
            <MessageSquare size={17} color={c.textMuted} />
            <Text style={[styles.actionText, { color: c.textSecondary }]}>댓글 {comments.length}</Text>
          </View>
        </View>
      ) : (
        <Text style={[styles.discussTitle, { color: c.textSecondary }]}>댓글 {comments.length}</Text>
      )}
      {comments.map((cm) => (
        <CommentItem
          key={cm.id}
          comment={cm}
          isMine={cm.author_id === uid}
          onUpdate={(t) => updateComment.mutate({ id: cm.id, text: t })}
          onDelete={() => deleteComment.mutate(cm.id)}
          onReply={() => setReplyTo(cm)}
        />
      ))}
      {comments.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>첫 댓글을 남겨보세요</Text>
      ) : null}

      {/* 답글 대상 표시 — X 로 해제하면 일반 댓글로 돌아간다 */}
      {replyTo ? (
        <View style={[styles.replyBar, { backgroundColor: c.surfaceSunken }]}>
          <CornerDownRight size={13} color={c.textMuted} />
          <Text style={[styles.replyBarText, { color: c.textSecondary }]} numberOfLines={1}>
            {replyTo.author?.name ?? "게스트"}님에게 답글
          </Text>
          <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
            <X size={14} color={c.textMuted} />
          </Pressable>
        </View>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={replyTo ? "답글 달기" : "댓글 달기"}
          placeholderTextColor={c.textMuted}
          style={[styles.input, { color: c.textPrimary, backgroundColor: c.surfaceSunken }]}
          multiline
        />
        <Pressable
          onPress={send}
          disabled={!text.trim() || createComment.isPending}
          style={[styles.sendBtn, { backgroundColor: text.trim() ? c.primary : c.surfaceSunken }]}
        >
          <Send size={17} color={text.trim() ? c.actionOn : c.textMuted} />
        </Pressable>
      </View>
    </View>
  );
}

/** 인사이트(의견) 전용 얇은 래퍼 — 기존 호출부 호환. */
export function OpinionThread({ opinionId, hideLike }: { opinionId: string; hideLike?: boolean }) {
  return <CommentThread target={{ kind: "opinion", id: opinionId }} hideLike={hideLike} />;
}

const styles = StyleSheet.create({
  thread: { gap: 12, marginTop: 4 },
  discussTitle: { ...dtype.label, fontSize: 12.5, fontWeight: "800" },
  actionsRow: { flexDirection: "row", alignItems: "center", gap: 18, paddingVertical: 4 },
  actionBtn: { flexDirection: "row", alignItems: "center", gap: 5 },
  actionText: { fontSize: 13, lineHeight: 18, fontWeight: "700" },

  comment: { flexDirection: "row", gap: 10 },
  reply: { marginLeft: 26 },
  replyIcon: { marginTop: 8 },
  cmHead: { flexDirection: "row", alignItems: "center", gap: 6 },
  cmWho: { ...dtype.bodyS, fontWeight: "700" },
  cmDate: { ...dtype.meta },
  cmText: { ...dtype.body, marginTop: 3, lineHeight: 22 },
  cmActions: { flexDirection: "row", gap: 14, marginTop: 6 },
  cmAction: { flexDirection: "row", alignItems: "center", gap: 4 },
  cmActionText: { ...dtype.meta },
  editWrap: { marginTop: 4, gap: 8 },
  editInput: { borderWidth: 1, borderRadius: 10, padding: 10, ...dtype.body, minHeight: 44 },
  editActions: { flexDirection: "row", justifyContent: "flex-end", gap: 16 },
  editBtn: { ...dtype.cardTitle, fontSize: 14 },
  empty: { ...dtype.bodyS, paddingVertical: 6 },

  replyBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  replyBarText: { ...dtype.bodyS, flex: 1, fontWeight: "600" },

  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 2 },
  input: { flex: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, maxHeight: 100, ...dtype.body },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
