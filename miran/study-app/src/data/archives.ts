/**
 * 아카이브(§34) — 글을 담아두는 **유일한** 수단.
 *
 * 예전에는 북마크(저장)와 아카이브(분류)가 따로였다. 없앴다 —
 * 저장 버튼과 담기 버튼이 나란히 있으면 "둘이 뭐가 다르지?"를 매번 생각해야 하고,
 * 실제로는 저장만 눌러놓고 분류는 안 하게 되어 두 숫자가 계속 어긋났다.
 * 지금은 **담기 하나뿐**이고, 담은 글이 곧 저장한 글이다.
 *
 * ⚠️ `article_bookmarks` 테이블과 기존 행은 지우지 않았다(되돌리기 쉽게). 앱이 안 쓸 뿐이다.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { Database } from "@/types/database";
import type { ArticleWithBlog } from "@/data/articles";

export type ArchiveRow = Database["public"]["Tables"]["archives"]["Row"];
/** 화면이 쓰는 모양 — 타일의 "N개"까지 붙인 것. */
export interface ArchiveWithCount extends ArchiveRow {
  count: number;
}

// ---- raw ----
export async function listArchives(uid: string): Promise<ArchiveWithCount[]> {
  const { data, error } = await supabase
    .from("archives")
    .select("*")
    .eq("user_id", uid)
    .order("sort", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as ArchiveRow[];
  if (rows.length === 0) return [];

  // 개수는 RPC 한 번으로 전부 받는다 — 타일마다 세면 쿼리가 타일 수만큼 늘어난다.
  // RPC 가 아직 없는 DB(§34 미적용)에서도 목록은 보여야 하므로 실패는 0개로 떨군다.
  const counts = new Map<string, number>();
  const { data: cnt } = await supabase.rpc("my_archive_counts", { p_user_id: uid });
  for (const r of (cnt ?? []) as { archive_id: string; cnt: number }[]) {
    counts.set(r.archive_id, Number(r.cnt) || 0);
  }
  return rows.map((r) => ({ ...r, count: counts.get(r.id) ?? 0 }));
}

export async function createArchive(uid: string, name: string, icon: string): Promise<ArchiveRow> {
  const { data, error } = await supabase
    .from("archives")
    .insert({ user_id: uid, name: name.trim(), icon })
    .select("*")
    .single();
  if (error) throw error;
  return data as ArchiveRow;
}

export async function updateArchive(
  archiveId: string,
  patch: { name?: string; icon?: string },
): Promise<void> {
  const { error } = await supabase.from("archives").update(patch).eq("id", archiveId);
  if (error) throw error;
}

export async function deleteArchive(archiveId: string): Promise<void> {
  // 담긴 글 행은 FK on delete cascade 로 같이 지워진다. 글 자체는 그대로 남는다.
  const { error } = await supabase.from("archives").delete().eq("id", archiveId);
  if (error) throw error;
}

export async function listArchiveArticles(archiveId: string): Promise<ArticleWithBlog[]> {
  const { data, error } = await supabase
    .from("archive_articles")
    .select("created_at, article:articles(*, blog:blogs(key, name, brand_color, homepage))")
    .eq("archive_id", archiveId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as { article: ArticleWithBlog | null }[])
    .map((r) => r.article)
    .filter((a): a is ArticleWithBlog => Boolean(a));
}

/** 이 글이 담긴 아카이브 id 들 — 담기 시트에서 체크 표시에 쓴다. */
export async function listArchiveIdsOfArticle(uid: string, articleId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("archive_articles")
    .select("archive_id, archive:archives!inner(user_id)")
    .eq("article_id", articleId)
    .eq("archive.user_id", uid);
  if (error) throw error;
  return ((data ?? []) as unknown as { archive_id: string }[]).map((r) => r.archive_id);
}

export async function setArchived(
  archiveId: string,
  articleId: string,
  on: boolean,
): Promise<void> {
  if (on) {
    const { error } = await supabase
      .from("archive_articles")
      .upsert({ archive_id: archiveId, article_id: articleId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("archive_articles")
      .delete()
      .eq("archive_id", archiveId)
      .eq("article_id", articleId);
    if (error) throw error;
  }
}

/**
 * 내가 어딘가에 담아둔 글 id 전부.
 * 카드마다 "담겼나"를 물으면 쿼리가 카드 수만큼 늘어난다 — 한 번에 받아 Set 으로 쓴다.
 */
export async function listArchivedArticleIds(uid: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("archive_articles")
    .select("article_id, archive:archives!inner(user_id)")
    .eq("archive.user_id", uid);
  if (error) throw error;
  const ids = ((data ?? []) as unknown as { article_id: string }[]).map((r) => r.article_id);
  return [...new Set(ids)];
}

/** 담긴 글 전체(중복 제거) — 아카이브 탭의 "모든 글" 타일. */
export async function listAllArchivedArticles(uid: string): Promise<ArticleWithBlog[]> {
  const { data, error } = await supabase
    .from("archive_articles")
    .select(
      "created_at, archive:archives!inner(user_id), article:articles(*, blog:blogs(key, name, brand_color, homepage))",
    )
    .eq("archive.user_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  const seen = new Set<string>();
  const out: ArticleWithBlog[] = [];
  for (const r of (data ?? []) as unknown as { article: ArticleWithBlog | null }[]) {
    if (r.article && !seen.has(r.article.id)) {
      seen.add(r.article.id);
      out.push(r.article);
    }
  }
  return out;
}

/** 완독률 — 담아둔 글 중 읽음 처리된 비율. RPC 가 없으면 null(카드를 숨긴다). */
export async function getReadRate(uid: string): Promise<{ saved: number; finished: number } | null> {
  const { data, error } = await supabase.rpc("my_read_rate", { p_user_id: uid });
  if (error) return null;
  const row = ((data ?? []) as { saved: number; finished: number }[])[0];
  if (!row) return null;
  return { saved: Number(row.saved) || 0, finished: Number(row.finished) || 0 };
}

// ---- hooks ----
export function useArchives() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.archives(uid),
    queryFn: () => listArchives(uid),
    enabled: Boolean(uid),
  });
}

export function useArchiveArticles(archiveId: string) {
  return useQuery({
    queryKey: qk.archiveArticles(archiveId),
    queryFn: () => listArchiveArticles(archiveId),
    enabled: Boolean(archiveId),
  });
}

export function useArchiveIdsOfArticle(articleId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: qk.archivesOfArticle(uid, articleId),
    queryFn: () => listArchiveIdsOfArticle(uid, articleId),
    enabled: Boolean(uid && articleId),
  });
}

export function useCreateArchive() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { name: string; icon: string }) => createArchive(uid, v.name, v.icon),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.archives(uid) }),
  });
}

export function useUpdateArchive() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { id: string; name?: string; icon?: string }) =>
      updateArchive(v.id, { name: v.name, icon: v.icon }),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.archives(uid) }),
  });
}

export function useDeleteArchive() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (archiveId: string) => deleteArchive(archiveId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.archives(uid) }),
  });
}

export function useToggleArchived(articleId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { archiveId: string; on: boolean }) =>
      setArchived(v.archiveId, articleId, v.on),
    onSuccess: (_d, v) => {
      qc.invalidateQueries({ queryKey: qk.archives(uid) });
      qc.invalidateQueries({ queryKey: qk.archivesOfArticle(uid, articleId) });
      qc.invalidateQueries({ queryKey: qk.archiveArticles(v.archiveId) });
      qc.invalidateQueries({ queryKey: qk.archivedIds(uid) });
      qc.invalidateQueries({ queryKey: qk.allArchived(uid) });
      qc.invalidateQueries({ queryKey: qk.readRate(uid) });
    },
  });
}

export function useArchivedIds() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.archivedIds(uid),
    queryFn: () => listArchivedArticleIds(uid),
    enabled: Boolean(uid),
  });
}

export function useAllArchivedArticles() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.allArchived(uid),
    queryFn: () => listAllArchivedArticles(uid),
    enabled: Boolean(uid),
  });
}

export function useReadRate() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.readRate(uid),
    queryFn: () => getReadRate(uid),
    enabled: Boolean(uid),
    staleTime: 60_000,
  });
}
