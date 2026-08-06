// distill 문장 하이라이트(article_highlights) — 원문 문장에 밑줄+감상. study 없는 전역판.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";

export interface ArticleHighlightAuthor {
  name: string;
  role_title: string | null;
}

export interface ArticleHighlightRow {
  id: string;
  article_id: string;
  author_id: string | null;
  sentence_index: number;
  quote: string | null;
  color: string;
  note: string | null;
  created_at: string;
  author: ArticleHighlightAuthor | null;
}

// ---- raw ----
export async function listArticleHighlights(
  articleId: string,
): Promise<ArticleHighlightRow[]> {
  const { data, error } = await supabase
    .from("article_highlights")
    .select("*, author:users(name, role_title)")
    .eq("article_id", articleId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as ArticleHighlightRow[];
}

export interface UpsertArticleHighlightInput {
  sentenceIndex: number;
  quote: string;
  color: string;
  note: string | null;
}

export async function upsertArticleHighlight(
  uid: string,
  articleId: string,
  input: UpsertArticleHighlightInput,
): Promise<void> {
  const { error } = await supabase.from("article_highlights").upsert(
    {
      author_id: uid,
      article_id: articleId,
      sentence_index: input.sentenceIndex,
      quote: input.quote,
      color: input.color,
      note: input.note,
    },
    { onConflict: "author_id,article_id,sentence_index" },
  );
  if (error) throw error;
}

export async function deleteArticleHighlight(id: string): Promise<void> {
  const { error } = await supabase.from("article_highlights").delete().eq("id", id);
  if (error) throw error;
}

// ---- hooks ----
export function useArticleHighlights(articleId: string) {
  return useQuery({
    queryKey: qk.articleHighlights(articleId),
    queryFn: () => listArticleHighlights(articleId),
    enabled: Boolean(articleId),
  });
}

export function useUpsertArticleHighlight(articleId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpsertArticleHighlightInput) =>
      upsertArticleHighlight(uid, articleId, input),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.articleHighlights(articleId) }),
  });
}

export function useDeleteArticleHighlight(articleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteArticleHighlight(id),
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: qk.articleHighlights(articleId) }),
  });
}
