// distill 댓글 스레드(opinion_comments) — 의견(인사이트)과 커뮤니티 자유글이 **같은 테이블**을 쓴다.
//   opinion_id | community_post_id 중 하나만 채워지고(스키마 §23), 나머지 로직(대댓글·좋아요·수정/삭제)은 공유.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";

export interface OpinionCommentAuthor {
  name: string;
  role_title: string | null;
}

export interface OpinionCommentRow {
  id: string;
  opinion_id: string | null;
  community_post_id: string | null;
  parent_id: string | null;
  author_id: string | null;
  text: string;
  quote: string | null;
  created_at: string;
  author: OpinionCommentAuthor | null;
}

/** 댓글이 달리는 대상 — 인사이트(의견) 또는 커뮤니티 자유글. */
export type CommentTarget =
  | { kind: "opinion"; id: string }
  | { kind: "community"; id: string };

const targetColumn = (t: CommentTarget) =>
  t.kind === "opinion" ? "opinion_id" : "community_post_id";

// ---- raw ----
export async function listThreadComments(t: CommentTarget): Promise<OpinionCommentRow[]> {
  const { data, error } = await supabase
    .from("opinion_comments")
    .select("*, author:users(name, role_title)")
    .eq(targetColumn(t), t.id)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as OpinionCommentRow[];
}

export const listOpinionComments = (opinionId: string) =>
  listThreadComments({ kind: "opinion", id: opinionId });

// 마이 "내 댓글" — 내가 단 댓글 + 어떤 의견/자유글에 달았는지.
export interface MyCommentRow {
  id: string;
  opinion_id: string | null;
  community_post_id: string | null;
  text: string;
  created_at: string;
  opinion: { id: string; article: { id: string; title: string } | null } | null;
  community_post: { id: string; title: string } | null;
}

export async function listMyComments(uid: string): Promise<MyCommentRow[]> {
  const { data, error } = await supabase
    .from("opinion_comments")
    .select(
      "id, opinion_id, community_post_id, text, created_at," +
        " opinion:opinions(id, article:articles(id, title))," +
        " community_post:community_posts(id, title)",
    )
    .eq("author_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MyCommentRow[];
}

/** 내 댓글 한 줄이 가리키는 원본 — 화면 이동/출처 표시에 쓴다. */
export function commentSource(row: MyCommentRow):
  | { kind: "opinion"; id: string; title: string }
  | { kind: "community"; id: string; title: string }
  | null {
  if (row.opinion_id) {
    return { kind: "opinion", id: row.opinion_id, title: row.opinion?.article?.title ?? "" };
  }
  if (row.community_post_id) {
    return { kind: "community", id: row.community_post_id, title: row.community_post?.title ?? "" };
  }
  return null;
}

export interface CreateOpinionCommentInput {
  text: string;
  parentId?: string | null;
  quote?: string | null;
}

export async function createThreadComment(
  uid: string,
  t: CommentTarget,
  input: CreateOpinionCommentInput,
): Promise<void> {
  const { error } = await supabase.from("opinion_comments").insert({
    // 둘 중 하나만 채운다(스키마 §23의 check 제약).
    opinion_id: t.kind === "opinion" ? t.id : null,
    community_post_id: t.kind === "community" ? t.id : null,
    parent_id: input.parentId ?? null,
    author_id: uid,
    text: input.text,
    quote: input.quote ?? null,
  });
  if (error) throw error;
}

export const createOpinionComment = (
  uid: string,
  opinionId: string,
  input: CreateOpinionCommentInput,
) => createThreadComment(uid, { kind: "opinion", id: opinionId }, input);

export async function updateOpinionComment(id: string, text: string): Promise<void> {
  const { error } = await supabase.from("opinion_comments").update({ text }).eq("id", id);
  if (error) throw error;
}

export async function deleteOpinionComment(id: string): Promise<void> {
  const { error } = await supabase.from("opinion_comments").delete().eq("id", id);
  if (error) throw error;
}

// ---- hooks ----
export function useThreadComments(t: CommentTarget) {
  return useQuery({
    queryKey: qk.threadComments(t.kind, t.id),
    queryFn: () => listThreadComments(t),
    enabled: Boolean(t.id),
  });
}

export function useOpinionComments(opinionId: string) {
  return useThreadComments({ kind: "opinion", id: opinionId });
}

export function useMyComments() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.myComments(uid),
    queryFn: () => listMyComments(uid),
    enabled: Boolean(uid),
  });
}

export function useCreateThreadComment(t: CommentTarget) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOpinionCommentInput) => createThreadComment(uid, t, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.threadComments(t.kind, t.id) }),
  });
}

export function useUpdateThreadComment(t: CommentTarget) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => updateOpinionComment(id, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.threadComments(t.kind, t.id) }),
  });
}

export function useDeleteThreadComment(t: CommentTarget) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOpinionComment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.threadComments(t.kind, t.id) }),
  });
}

export const useCreateOpinionComment = (opinionId: string) =>
  useCreateThreadComment({ kind: "opinion", id: opinionId });
export const useUpdateOpinionComment = (opinionId: string) =>
  useUpdateThreadComment({ kind: "opinion", id: opinionId });
export const useDeleteOpinionComment = (opinionId: string) =>
  useDeleteThreadComment({ kind: "opinion", id: opinionId });
