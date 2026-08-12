// distill 의견(독후감) 임시저장(opinion_drafts) — 작성중 저장/이어쓰기(글당 1개). 본인만.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { Insight } from "@/lib/insight";

export interface OpinionDraftRow {
  id: string;
  article_id: string;
  insight: Insight;
  updated_at: string;
  article: { id: string; title: string } | null;
}

// ---- raw ----
export async function getDraft(uid: string, articleId: string): Promise<Insight | null> {
  const { data, error } = await supabase
    .from("opinion_drafts")
    .select("insight")
    .eq("user_id", uid)
    .eq("article_id", articleId)
    .maybeSingle();
  if (error) throw error;
  return (data?.insight as Insight | undefined) ?? null;
}

export async function listMyDrafts(uid: string): Promise<OpinionDraftRow[]> {
  const { data, error } = await supabase
    .from("opinion_drafts")
    .select("id, article_id, insight, updated_at, article:articles(id, title)")
    .eq("user_id", uid)
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OpinionDraftRow[];
}

export async function upsertDraft(uid: string, articleId: string, insight: Insight): Promise<void> {
  const { error } = await supabase.from("opinion_drafts").upsert(
    { user_id: uid, article_id: articleId, insight, updated_at: new Date().toISOString() },
    { onConflict: "user_id,article_id" },
  );
  if (error) throw error;
}

export async function deleteDraft(uid: string, articleId: string): Promise<void> {
  const { error } = await supabase
    .from("opinion_drafts")
    .delete()
    .eq("user_id", uid)
    .eq("article_id", articleId);
  if (error) throw error;
}

// ---- hooks ----
export function useMyDrafts() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.drafts(uid),
    queryFn: () => listMyDrafts(uid),
    enabled: Boolean(uid),
  });
}

export function useDraft(articleId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: qk.draft(uid, articleId),
    queryFn: () => getDraft(uid, articleId),
    enabled: Boolean(uid && articleId),
  });
}

export function useUpsertDraft(articleId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (insight: Insight) => upsertDraft(uid, articleId, insight),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.drafts(uid) });
      qc.invalidateQueries({ queryKey: qk.draft(uid, articleId) });
    },
  });
}

export function useDeleteDraft(articleId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => deleteDraft(uid, articleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.drafts(uid) });
      qc.invalidateQueries({ queryKey: qk.draft(uid, articleId) });
    },
  });
}
