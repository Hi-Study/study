// distill 커뮤니티 자유글 — 인사이트 탭의 '커뮤니티' 서브탭.
// 규약: 화면은 supabase 직접 호출 금지, 이 계층의 raw 함수/use* 훅만 사용.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";

export interface CommunityPost {
  id: string;
  author_id: string | null;
  title: string;
  body: string;
  like_count: number;
  created_at: string;
  author: { name: string; role_title: string | null } | null;
}

const SELECT_WITH_AUTHOR = "*, author:users(name, role_title)";

// ---- 목록(최신순) ----
export async function listCommunityPosts(limit = 50): Promise<CommunityPost[]> {
  const { data, error } = await supabase
    .from("community_posts")
    .select(SELECT_WITH_AUTHOR)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as CommunityPost[];
}

export function useCommunityPosts() {
  return useQuery({ queryKey: qk.communityPosts(), queryFn: () => listCommunityPosts() });
}

// ---- 작성 ----
export async function createCommunityPost(
  uid: string,
  input: { title: string; body: string },
): Promise<string> {
  const { data, error } = await supabase
    .from("community_posts")
    .insert({ author_id: uid, title: input.title, body: input.body })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export function useCreateCommunityPost() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; body: string }) => createCommunityPost(uid, input),
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
