// distill 의견 대댓글(opinion_comments) — 의견에 대한 토론 스레드.
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
  opinion_id: string;
  parent_id: string | null;
  author_id: string | null;
  text: string;
  quote: string | null;
  created_at: string;
  author: OpinionCommentAuthor | null;
}

// ---- raw ----
export async function listOpinionComments(
  opinionId: string,
): Promise<OpinionCommentRow[]> {
  const { data, error } = await supabase
    .from("opinion_comments")
    .select("*, author:users(name, role_title)")
    .eq("opinion_id", opinionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as OpinionCommentRow[];
}

// 마이 "내 댓글" — 내가 단 댓글 + 어떤 의견/글에 달았는지.
export interface MyCommentRow {
  id: string;
  opinion_id: string;
  text: string;
  created_at: string;
  opinion: { id: string; article: { id: string; title: string } | null } | null;
}

export async function listMyComments(uid: string): Promise<MyCommentRow[]> {
  const { data, error } = await supabase
    .from("opinion_comments")
    .select("id, opinion_id, text, created_at, opinion:opinions(id, article:articles(id, title))")
    .eq("author_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MyCommentRow[];
}

export interface CreateOpinionCommentInput {
  text: string;
  parentId?: string | null;
  quote?: string | null;
}

export async function createOpinionComment(
  uid: string,
  opinionId: string,
  input: CreateOpinionCommentInput,
): Promise<void> {
  const { error } = await supabase.from("opinion_comments").insert({
    opinion_id: opinionId,
    parent_id: input.parentId ?? null,
    author_id: uid,
    text: input.text,
    quote: input.quote ?? null,
  });
  if (error) throw error;
}

export async function updateOpinionComment(id: string, text: string): Promise<void> {
  const { error } = await supabase.from("opinion_comments").update({ text }).eq("id", id);
  if (error) throw error;
}

export async function deleteOpinionComment(id: string): Promise<void> {
  const { error } = await supabase.from("opinion_comments").delete().eq("id", id);
  if (error) throw error;
}

// ---- hooks ----
export function useOpinionComments(opinionId: string) {
  return useQuery({
    queryKey: qk.opinionComments(opinionId),
    queryFn: () => listOpinionComments(opinionId),
    enabled: Boolean(opinionId),
  });
}

export function useMyComments() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.myComments(uid),
    queryFn: () => listMyComments(uid),
    enabled: Boolean(uid),
  });
}

export function useCreateOpinionComment(opinionId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateOpinionCommentInput) =>
      createOpinionComment(uid, opinionId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.opinionComments(opinionId) }),
  });
}

export function useUpdateOpinionComment(opinionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, text }: { id: string; text: string }) => updateOpinionComment(id, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.opinionComments(opinionId) }),
  });
}

export function useDeleteOpinionComment(opinionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOpinionComment(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.opinionComments(opinionId) }),
  });
}
