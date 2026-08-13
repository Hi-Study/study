// distill 의견 댓글 스레드(인라인 재사용) — 좋아요 + 댓글/대댓글(본인 수정·삭제) + 입력.
//   글 상세 '의견' 탭에서 이동 없이 펼쳐 쓰기 위해 컴포넌트로 분리.
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Heart, Pencil, Send, Trash2 } from "lucide-react-native";

import { useTheme } from "@/providers/ThemeProvider";
import { useUid } from "@/auth/AuthProvider";
import {
  useOpinionComments,
  useCreateOpinionComment,
  useUpdateOpinionComment,
  useDeleteOpinionComment,
  useLiked,
  useToggleReaction,
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
}: {
  comment: OpinionCommentRow;
  isMine: boolean;
  onUpdate: (text: string) => void;
  onDelete: () => void;
}) {
  const { theme } = useTheme();
  const c = theme.colors;
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(comment.text);
  const liked = useLiked("comment", comment.id);
  const toggleLike = useToggleReaction("comment", comment.id);

  return (
    <View style={[styles.comment, comment.parent_id ? styles.reply : null]}>
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

// 의견 하나의 좋아요 + 댓글 스레드 + 입력(인라인).
export function OpinionThread({ opinionId }: { opinionId: string }) {
  const { theme } = useTheme();
  const c = theme.colors;
  const uid = useUid();
  const commentsQ = useOpinionComments(opinionId);
  const createComment = useCreateOpinionComment(opinionId);
  const updateComment = useUpdateOpinionComment(opinionId);
  const deleteComment = useDeleteOpinionComment(opinionId);
  const liked = useLiked("opinion", opinionId);
  const toggleLike = useToggleReaction("opinion", opinionId);
  const [text, setText] = useState("");

  const comments = commentsQ.data ?? [];
  const send = () => {
    const t = text.trim();
    if (!t) return;
    createComment.mutate({ text: t }, { onSuccess: () => setText("") });
  };

  return (
    <View style={styles.thread}>
      <Pressable
        onPress={() => toggleLike.mutate(liked.data ?? false)}
        disabled={toggleLike.isPending}
        hitSlop={6}
        style={[
          styles.likeRow,
          { borderColor: liked.data ? c.danger : c.hairline, backgroundColor: liked.data ? c.hotTint : "transparent" },
        ]}
      >
        <Heart size={15} color={liked.data ? c.danger : c.textMuted} fill={liked.data ? c.danger : "transparent"} />
        <Text style={[styles.likeText, { color: liked.data ? c.danger : c.textSecondary }]}>좋아요</Text>
      </Pressable>

      <Text style={[styles.discussTitle, { color: c.textSecondary }]}>토론 {comments.length}</Text>
      {comments.map((cm) => (
        <CommentItem
          key={cm.id}
          comment={cm}
          isMine={cm.author_id === uid}
          onUpdate={(t) => updateComment.mutate({ id: cm.id, text: t })}
          onDelete={() => deleteComment.mutate(cm.id)}
        />
      ))}
      {comments.length === 0 ? (
        <Text style={[styles.empty, { color: c.textMuted }]}>첫 댓글을 남겨보세요</Text>
      ) : null}

      <View style={styles.inputRow}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="댓글 달기"
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

const styles = StyleSheet.create({
  thread: { gap: 12, marginTop: 4 },
  likeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  likeText: { ...dtype.label, fontSize: 13 },
  discussTitle: { ...dtype.label, fontSize: 12.5, fontWeight: "800" },

  comment: { flexDirection: "row", gap: 10 },
  reply: { marginLeft: 32 },
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

  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 2 },
  input: { flex: 1, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 9, maxHeight: 100, ...dtype.body },
  sendBtn: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
});
