import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useUid } from "@/auth/AuthProvider";

export interface HighlightAuthor {
  name: string;
  role_title: string | null;
}

export interface HighlightRow {
  id: string;
  share_id: string;
  study_id: string;
  author_id: string | null;
  sentence_index: number;
  quote: string | null;
  color: string;
  note: string | null;
  created_at: string;
  author: HighlightAuthor | null;
}

// ---- raw ----
export async function listHighlights(shareId: string): Promise<HighlightRow[]> {
  const { data, error } = await supabase
    .from("highlights")
    .select("*, author:users(name, role_title)")
    .eq("share_id", shareId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as HighlightRow[];
}

export interface UpsertHighlightInput {
  studyId: string;
  sentenceIndex: number;
  quote: string;
  color: string;
  note: string | null;
}

export async function upsertHighlight(
  uid: string,
  shareId: string,
  input: UpsertHighlightInput,
): Promise<void> {
  const { error } = await supabase.from("highlights").upsert(
    {
      author_id: uid,
      share_id: shareId,
      study_id: input.studyId,
      sentence_index: input.sentenceIndex,
      quote: input.quote,
      color: input.color,
      note: input.note,
    },
    { onConflict: "author_id,share_id,sentence_index" },
  );
  if (error) throw error;
}

export async function deleteHighlight(id: string): Promise<void> {
  const { error } = await supabase.from("highlights").delete().eq("id", id);
  if (error) throw error;
}

// ---- hooks ----
export function useHighlights(shareId: string) {
  return useQuery({
    queryKey: ["highlights", shareId] as const,
    queryFn: () => listHighlights(shareId),
    enabled: Boolean(shareId),
  });
}

export function useUpsertHighlight(shareId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertHighlightInput) => upsertHighlight(uid, shareId, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["highlights", shareId] }),
  });
}

export function useDeleteHighlight(shareId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteHighlight(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["highlights", shareId] }),
  });
}
