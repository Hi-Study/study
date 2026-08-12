// distill 문장 하이라이트(article_highlights) — 원문 문장에 밑줄+감상. study 없는 전역판.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { Topic } from "@/types/database";

export interface ArticleHighlightAuthor {
  name: string;
  role_title: string | null;
}

// 내 하이라이트 모아보기용 — 문장 + 감상 + 출처 글(제목/주제).
export interface MyHighlightArticleLite {
  id: string;
  title: string;
  topic: Topic | null;
}

export interface MyHighlightRow {
  id: string;
  article_id: string;
  sentence_index: number;
  quote: string | null;
  color: string;
  note: string | null;
  created_at: string;
  article: MyHighlightArticleLite | null;
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
// 하이라이트/메모는 "나만 보기"(비공개) — 본인 것만 조회한다.
export async function listArticleHighlights(
  uid: string,
  articleId: string,
): Promise<ArticleHighlightRow[]> {
  const { data, error } = await supabase
    .from("article_highlights")
    .select("*, author:users(name, role_title)")
    .eq("article_id", articleId)
    .eq("author_id", uid)
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

/** 내가 남긴 하이라이트 전체(글 제목·주제 포함) — 마이 탭 "내 하이라이트" 모아보기. */
export async function listMyHighlights(uid: string): Promise<MyHighlightRow[]> {
  const { data, error } = await supabase
    .from("article_highlights")
    .select("id, article_id, sentence_index, quote, color, note, created_at, article:articles(id, title, topic)")
    .eq("author_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as MyHighlightRow[];
}

// ---- hooks ----
export function useArticleHighlights(articleId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: qk.articleHighlights(articleId, uid),
    queryFn: () => listArticleHighlights(uid, articleId),
    enabled: Boolean(articleId && uid),
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

export function useMyHighlights() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.myHighlights(uid),
    queryFn: () => listMyHighlights(uid),
    enabled: Boolean(uid),
  });
}
