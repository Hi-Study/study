// distill 읽은 아티클(article_reads) — 다 읽음(스크롤 90%) 기록 + 마이 읽음 모아보기. 본인만.
// (+ 조회수 증가 RPC: increment_article_view)
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { ArticleWithBlog } from "@/data/articles";

// ---- raw ----
export async function markArticleRead(uid: string, articleId: string): Promise<void> {
  const { error } = await supabase
    .from("article_reads")
    .upsert({ user_id: uid, article_id: articleId }, { onConflict: "user_id,article_id" });
  if (error) throw error;
}

export async function listReadIds(uid: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("article_reads")
    .select("article_id")
    .eq("user_id", uid);
  if (error) throw error;
  return (data ?? []).map((r) => r.article_id);
}

/** 읽은 글 + **읽은 날짜**(read_at). 활동 캘린더/그날 활동 화면에서 날짜별로 묶는 데 쓴다. */
export interface MyReadArticle extends ArticleWithBlog {
  read_at: string | null;
}

export async function listMyReads(uid: string): Promise<MyReadArticle[]> {
  const { data, error } = await supabase
    .from("article_reads")
    .select("created_at, article:articles(*, blog:blogs(key, name, brand_color))")
    .eq("user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { created_at: string | null; article: ArticleWithBlog | null }[])
    .filter((r): r is { created_at: string | null; article: ArticleWithBlog } => Boolean(r.article))
    .map((r) => ({ ...r.article, read_at: r.created_at }));
}

/** 조회수 +1 — 글 상세 진입 시 1회 호출(RPC, 서버 권한으로 articles.view_count 갱신). */
export async function incrementArticleView(articleId: string): Promise<void> {
  const { error } = await supabase.rpc("increment_article_view", { aid: articleId });
  if (error) throw error;
}

// ---- hooks ----
export function useMyReads() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.reads(uid),
    queryFn: () => listMyReads(uid),
    enabled: Boolean(uid),
  });
}

export function useReadIds() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.readIds(uid),
    queryFn: () => listReadIds(uid),
    enabled: Boolean(uid),
  });
}

export function useMarkArticleRead(articleId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markArticleRead(uid, articleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.reads(uid) });
      qc.invalidateQueries({ queryKey: qk.readIds(uid) });
    },
  });
}
