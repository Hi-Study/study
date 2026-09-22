// distill 의견(opinions) — 글에 대한 "핵심 인사이트"(구조화). study 없는 전역판.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import { isMissingColumnError } from "@/lib/pgError";
import type { Insight } from "@/lib/insight";
import type { ArticleLevel, PlannerCategory, Topic } from "@/types/database";

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
  /** 개발 지식 난도 — 인사이트 탭에서도 난이도로 걸러 볼 수 있어야 한다. */
  level: ArticleLevel | null;
  url: string;
  summary: string | null;
  /** 기준 v1 대분류 — 마이 > 내 활동의 주제 필터가 쓴다(lib/myActivity.ts). */
  planner_category: PlannerCategory | null;
  blog: { id: string; key: string; name: string; brand_color: string | null; homepage: string | null } | null;
}

export interface OpinionFeedItem extends OpinionWithAuthor {
  article: OpinionArticleLite | null;
}

const OPINION_SELECT =
  // reading_guide 까지 함께 받는다 — 마이 > 그날 활동의 "레퍼런스로 내보내기"가
  // 한 줄 요약·1분 이해·용어를 이 값에서 꺼낸다(글마다 따로 조회하면 하루치가 N+1이 된다).
  "*, author:users(name, role_title), article:articles(id, title, og_image, topic, level, url, summary, reading_guide, planner_category, blog:blogs(id, key, name, brand_color, homepage))";

// ⚠️ 전체 인사이트 피드(listOpinionsFeed / useOpinionsFeed)는 지웠다 — PRODUCT.md §4.
//    인사이트는 그 글을 읽은 사람에게만 의미가 있다. 목록으로 떼면 남의 감상문 모음일 뿐이다.
//    인사이트를 보는 곳은 ① 글 상세 하단 ② 마이 "내 의견" 둘뿐이다.

export async function getOpinion(opinionId: string): Promise<OpinionFeedItem> {
  const { data, error } = await supabase
    .from("opinions")
    .select(OPINION_SELECT)
    .eq("id", opinionId)
    .single();
  if (error) throw error;
  return data as unknown as OpinionFeedItem;
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
    queryKey: qk.myOpinions(uid),
    queryFn: () => listMyOpinions(uid),
    enabled: Boolean(uid),
  });
}

// ⚠️ 작성자별 인사이트 조회(인사이터 프로필)는 지웠다 — PRODUCT.md §4.
//    사람을 따라다니게 만들면 글이 아니라 사람이 중심이 된다.
