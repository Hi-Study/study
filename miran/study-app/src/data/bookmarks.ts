// distill 북마크(article_bookmarks) — 글 저장/해제 + 마이 북마크 모아보기. 본인만.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { ArticleWithBlog } from "@/data/articles";

// ---- raw ----
export async function listMyBookmarks(uid: string): Promise<ArticleWithBlog[]> {
  const { data, error } = await supabase
    .from("article_bookmarks")
    .select("created_at, article:articles(*, blog:blogs(key, name, brand_color))")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { article: ArticleWithBlog | null }[])
    .map((r) => r.article)
    .filter((a): a is ArticleWithBlog => Boolean(a));
}

export async function getBookmarked(uid: string, articleId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("article_bookmarks")
    .select("article_id")
    .eq("user_id", uid)
    .eq("article_id", articleId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function setBookmark(uid: string, articleId: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await supabase
      .from("article_bookmarks")
      .upsert({ user_id: uid, article_id: articleId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("article_bookmarks")
      .delete()
      .eq("user_id", uid)
      .eq("article_id", articleId);
    if (error) throw error;
  }
}

// ---- hooks ----
export function useMyBookmarks() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.bookmarks(uid),
    queryFn: () => listMyBookmarks(uid),
    enabled: Boolean(uid),
  });
}

export function useIsBookmarked(articleId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: [...qk.bookmarkIds(uid), articleId] as const,
    queryFn: () => getBookmarked(uid, articleId),
    enabled: Boolean(uid && articleId),
  });
}

export function useToggleBookmark(articleId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => setBookmark(uid, articleId, on),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.bookmarks(uid) });
      qc.invalidateQueries({ queryKey: qk.bookmarkIds(uid) });
    },
  });
}
