// distill 댓글 스레드(opinion_comments) — **인사이트에만** 달린다.
//   테이블은 커뮤니티 자유글과 공유하도록 만들어졌지만(스키마 §23) 자유글은 걷어냈다.
//   그래서 앱은 opinion_id 만 쓴다. 테이블·기존 행은 그대로 둔다(되돌리기 쉽게).
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

/**
 * 댓글이 달리는 대상 — 인사이트뿐이다.
 * `kind` 를 남겨둔 이유: 호출부가 전부 `{ kind: "opinion", id }` 모양이라 지우면 그 줄이 전부 바뀐다.
 * 값이 하나여도 타입이 대상을 분명히 말해준다.
 */
export type CommentTarget = { kind: "opinion"; id: string };

const targetColumn = (_t: CommentTarget) => "opinion_id";

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

/**
 * 마이 "내 댓글" — 내가 단 댓글 + 어떤 인사이트에 달았는지.
 *
 * ⚠️ 커뮤니티 자유글은 걷어냈다(PRODUCT.md §4). 예전에 자유글에 단 댓글 행이 DB 에
 *    남아 있을 수 있는데, **가져오지 않는다.** 가져와도 열 화면이 없어서
 *    "눌러도 아무 일 없는 줄"이 되고, 그게 버그처럼 보인다.
 *    행은 지우지 않는다 — 기능을 되돌리면 그대로 다시 보이게.
 */
export interface MyCommentRow {
  id: string;
  opinion_id: string | null;
  text: string;
  created_at: string;
  opinion: { id: string; article: { id: string; title: string; planner_category: string | null } | null } | null;
}

export async function listMyComments(uid: string): Promise<MyCommentRow[]> {
  const { data, error } = await supabase
    .from("opinion_comments")
    .select("id, opinion_id, text, created_at, opinion:opinions(id, article:articles(id, title, planner_category))")
    .eq("author_id", uid)
    .not("opinion_id", "is", null)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MyCommentRow[];
}

/** 내 댓글 한 줄이 가리키는 원본 — 화면 이동/출처 표시에 쓴다. */
export function commentSource(
  row: MyCommentRow,
): { kind: "opinion"; id: string; title: string } | null {
  if (row.opinion_id) {
    return { kind: "opinion", id: row.opinion_id, title: row.opinion?.article?.title ?? "" };
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
    // 스키마 §23 의 check 제약은 둘 중 하나만 채우길 요구한다 — 앱은 인사이트만 쓴다.
    opinion_id: t.id,
    community_post_id: null,
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
