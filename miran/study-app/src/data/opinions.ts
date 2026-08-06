// distill 의견(opinions) — 글에 대한 "핵심 인사이트"(구조화). study 없는 전역판.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { Insight } from "@/lib/insight";
import type { Topic } from "@/types/database";

export interface OpinionAuthor {
  name: string;
  role_title: string | null;
}

export interface OpinionWithAuthor {
  id: string;
  article_id: string;
  author_id: string | null;
  insight: Insight;
  like_count: number;
  created_at: string;
  author: OpinionAuthor | null;
}

export type OpinionSort = "latest" | "popular";

// ---- raw ----
export async function listOpinions(articleId: string): Promise<OpinionWithAuthor[]> {
  const { data, error } = await supabase
    .from("opinions")
    .select("*, author:users(name, role_title)")
    .eq("article_id", articleId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OpinionWithAuthor[];
}

export async function createOpinion(
  uid: string,
  articleId: string,
  insight: Insight,
): Promise<void> {
  const { error } = await supabase.from("opinions").insert({
    article_id: articleId,
    author_id: uid,
    insight,
  });
  if (error) throw error;
}

export async function deleteOpinion(id: string): Promise<void> {
  const { error } = await supabase.from("opinions").delete().eq("id", id);
  if (error) throw error;
}

// ---- hooks ----
export function useOpinions(articleId: string) {
  return useQuery({
    queryKey: qk.opinions(articleId),
    queryFn: () => listOpinions(articleId),
    enabled: Boolean(articleId),
  });
}

export function useCreateOpinion(articleId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (insight: Insight) => createOpinion(uid, articleId, insight),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.opinions(articleId) }),
  });
}

export function useDeleteOpinion(articleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => deleteOpinion(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.opinions(articleId) }),
  });
}

// ---- 토론 탭: 전체 의견 피드 + 의견 상세(출처 글 포함) ----
export interface OpinionArticleLite {
  id: string;
  title: string;
  og_image: string | null;
  topic: Topic | null;
  url: string;
  summary: string | null;
  blog: { name: string; brand_color: string | null } | null;
}

export interface OpinionFeedItem extends OpinionWithAuthor {
  article: OpinionArticleLite | null;
}

const OPINION_SELECT =
  "*, author:users(name, role_title), article:articles(id, title, og_image, topic, url, summary, blog:blogs(name, brand_color))";

/** 전체 의견 피드 — 작성자 + 출처 글 요약 포함. 인기순(like_count) 또는 최신순. */
export async function listOpinionsFeed(sort: OpinionSort = "latest"): Promise<OpinionFeedItem[]> {
  const base = supabase.from("opinions").select(OPINION_SELECT).limit(50);
  const query =
    sort === "popular"
      ? base.order("like_count", { ascending: false }).order("created_at", { ascending: false })
      : base.order("created_at", { ascending: false });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as OpinionFeedItem[];
}

export async function getOpinion(opinionId: string): Promise<OpinionFeedItem> {
  const { data, error } = await supabase
    .from("opinions")
    .select(OPINION_SELECT)
    .eq("id", opinionId)
    .single();
  if (error) throw error;
  return data as unknown as OpinionFeedItem;
}

export function useOpinionsFeed(sort: OpinionSort = "latest") {
  return useQuery({
    queryKey: qk.opinionsFeed(sort === "latest" ? undefined : sort),
    queryFn: () => listOpinionsFeed(sort),
  });
}

export function useOpinion(opinionId: string) {
  return useQuery({
    queryKey: qk.opinion(opinionId),
    queryFn: () => getOpinion(opinionId),
    enabled: Boolean(opinionId),
  });
}

/** 내가 쓴 의견(마이 탭). */
export async function listMyOpinions(uid: string): Promise<OpinionFeedItem[]> {
  const { data, error } = await supabase
    .from("opinions")
    .select(OPINION_SELECT)
    .eq("author_id", uid)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as OpinionFeedItem[];
}

export function useMyOpinions() {
  const uid = useUid();
  return useQuery({
    queryKey: [...qk.opinionsFeed(), "mine", uid] as const,
    queryFn: () => listMyOpinions(uid),
    enabled: Boolean(uid),
  });
}
