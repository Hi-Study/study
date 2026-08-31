// distill 커뮤니티 자유글 — 인사이트 탭의 '커뮤니티' 서브탭.
// 규약: 화면은 supabase 직접 호출 금지, 이 계층의 raw 함수/use* 훅만 사용.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import { isMissingColumnError } from "@/lib/pgError";
import type { Insight } from "@/lib/insight";

export interface CommunityPost {
  id: string;
  author_id: string | null;
  title: string;
  body: string;
  insight: Insight | Record<string, never>;
  like_count: number;
  comment_count: number;
  created_at: string;
  author: { name: string; role_title: string | null } | null;
}

/** latest = 최신순(커뮤니티 탭) / active = 이야기 많은 순(홈 "이야기 나누고 있어요"). */
export type CommunitySort = "latest" | "active";

const SELECT_WITH_AUTHOR = "*, author:users(name, role_title)";

// ---- 목록 ----
export async function listCommunityPosts(
  sort: CommunitySort = "latest",
  limit = 50,
): Promise<CommunityPost[]> {
  const base = supabase.from("community_posts").select(SELECT_WITH_AUTHOR).limit(limit);
  const build = (byActivity: boolean) =>
    byActivity
      ? base
          .order("comment_count", { ascending: false })
          .order("like_count", { ascending: false })
          .order("created_at", { ascending: false })
      : base.order("created_at", { ascending: false });

  // comment_count 는 스키마 §23-3 컬럼 — 아직 SQL 미적용이면 최신순으로 폴백.
  let { data, error } = await build(sort === "active");
  if (error && sort === "active" && isMissingColumnError(error)) {
    ({ data, error } = await build(false));
  }
  if (error) throw error;
  return (data ?? []) as unknown as CommunityPost[];
}

export function useCommunityPosts(sort: CommunitySort = "latest") {
  return useQuery({
    queryKey: [...qk.communityPosts(), sort] as const,
    queryFn: () => listCommunityPosts(sort),
  });
}

// ---- 단건(자유글 상세) ----
export async function getCommunityPost(postId: string): Promise<CommunityPost> {
  const { data, error } = await supabase
    .from("community_posts")
    .select(SELECT_WITH_AUTHOR)
    .eq("id", postId)
    .single();
  if (error) throw error;
  return data as unknown as CommunityPost;
}

export function useCommunityPost(postId: string) {
  return useQuery({
    queryKey: qk.communityPost(postId),
    queryFn: () => getCommunityPost(postId),
    enabled: Boolean(postId),
  });
}

// ---- 작성 ----
export async function createCommunityPost(
  uid: string,
  input: { title: string; body?: string; insight?: Insight },
): Promise<string> {
  const { data, error } = await supabase
    .from("community_posts")
    .insert({
      author_id: uid,
      title: input.title,
      body: input.body ?? "",
      insight: (input.insight ?? {}) as unknown as Record<string, unknown>,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export function useCreateCommunityPost() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; body?: string; insight?: Insight }) =>
      createCommunityPost(uid, input),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.communityPosts() }),
  });
}

// ---- 삭제(본인) ----
export async function deleteCommunityPost(postId: string): Promise<void> {
  const { error } = await supabase.from("community_posts").delete().eq("id", postId);
  if (error) throw error;
}

export function useDeleteCommunityPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (postId: string) => deleteCommunityPost(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.communityPosts() }),
  });
}
