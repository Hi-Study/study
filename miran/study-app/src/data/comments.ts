import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { CommentTarget } from "@/types/database";
import type { CommentRow } from "@/types/tables";

export interface CommentAuthor {
  name: string;
  role_title: string | null;
}

export interface CommentWithAuthor extends CommentRow {
  author: CommentAuthor | null;
  likeCount: number;
}

// ---- raw ----
/** 대상(공유글/토론)의 댓글을 등록순으로 flat 반환(작성자 조인 + 좋아요 수). 정렬/트리는 UI 에서. */
export async function listComments(
  targetType: CommentTarget,
  targetId: string,
): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from("comments")
    .select("*, author:users(name, role_title)")
    .eq("target_type", targetType)
    .eq("target_id", targetId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  const base = (data ?? []) as unknown as (CommentRow & {
    author: CommentAuthor | null;
  })[];

  // 좋아요 수 배치 집계 (정렬용)
  const ids = base.map((r) => r.id);
  const count: Record<string, number> = {};
  if (ids.length > 0) {
    const { data: likes, error: lErr } = await supabase
      .from("likes")
      .select("target_id")
      .eq("target_type", "comment")
      .in("target_id", ids);
    if (lErr) throw lErr;
    for (const l of likes ?? []) count[l.target_id] = (count[l.target_id] ?? 0) + 1;
  }

  return base.map((r) => ({ ...r, likeCount: count[r.id] ?? 0 }));
}

export interface CreateCommentInput {
  studyId: string;
  targetType: CommentTarget;
  targetId: string;
  text: string;
  /** 대댓글이면 부모 댓글 id */
  parentId?: string | null;
  /** 대댓글 인용 원문 스냅샷 */
  quote?: string | null;
}

export async function createComment(
  uid: string,
  input: CreateCommentInput,
): Promise<CommentRow> {
  const { data, error } = await supabase
    .from("comments")
    .insert({
      study_id: input.studyId,
      target_type: input.targetType,
      target_id: input.targetId,
      author_id: uid,
      text: input.text,
      parent_id: input.parentId ?? null,
      quote: input.quote ?? null,
    })
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function updateComment(id: string, text: string): Promise<void> {
  const { error } = await supabase.from("comments").update({ text }).eq("id", id);
  if (error) throw error;
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from("comments").delete().eq("id", id);
  if (error) throw error;
}

// ---- hooks ----
export function useComments(targetType: CommentTarget, targetId: string) {
  return useQuery({
    queryKey: qk.comments(targetType, targetId),
    queryFn: () => listComments(targetType, targetId),
    enabled: Boolean(targetId),
  });
}

/** 댓글 변경 시 참여 여부·미참여 카운트가 바뀌므로 관련 쿼리를 함께 무효화. */
function invalidateAfterComment(
  qc: ReturnType<typeof useQueryClient>,
  targetType: CommentTarget,
  targetId: string,
  studyId: string,
) {
  qc.invalidateQueries({ queryKey: qk.comments(targetType, targetId) });
  qc.invalidateQueries({ queryKey: qk.discussions(studyId) });
  qc.invalidateQueries({ queryKey: ["discussion"] });
  qc.invalidateQueries({ queryKey: qk.dashboard() });
  qc.invalidateQueries({ queryKey: qk.myStudies() });
}

export function useCreateComment(
  targetType: CommentTarget,
  targetId: string,
) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Omit<CreateCommentInput, "targetType" | "targetId">) =>
      createComment(uid, { ...input, targetType, targetId }),
    onSuccess: (_data, variables) =>
      invalidateAfterComment(qc, targetType, targetId, variables.studyId),
  });
}

export function useUpdateComment(targetType: CommentTarget, targetId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => updateComment(id, text),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.comments(targetType, targetId) }),
  });
}

export function useDeleteComment(
  targetType: CommentTarget,
  targetId: string,
  studyId?: string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteComment,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.comments(targetType, targetId) });
      if (studyId) invalidateAfterComment(qc, targetType, targetId, studyId);
    },
  });
}
