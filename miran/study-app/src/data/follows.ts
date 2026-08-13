// distill 팔로우 + 인사이터 프로필. user_follows 기반. 팔로우하면 그 사람 새 의견 알림(트리거).
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";

export interface InsighterProfile {
  id: string;
  name: string;
  role_title: string | null;
  created_at: string;
}

export interface FollowCounts {
  followers: number;
  following: number;
}

// ---- raw ----
export async function getUserProfile(userId: string): Promise<InsighterProfile | null> {
  const { data, error } = await supabase
    .from("users")
    .select("id, name, role_title, created_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as InsighterProfile) ?? null;
}

export async function getFollowCounts(userId: string): Promise<FollowCounts> {
  const [followers, following] = await Promise.all([
    supabase.from("user_follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId),
    supabase.from("user_follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId),
  ]);
  return { followers: followers.count ?? 0, following: following.count ?? 0 };
}

export async function getIsFollowing(uid: string, userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("user_follows")
    .select("following_id")
    .eq("follower_id", uid)
    .eq("following_id", userId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

export async function setFollow(uid: string, userId: string, on: boolean): Promise<void> {
  if (on) {
    const { error } = await supabase
      .from("user_follows")
      .upsert({ follower_id: uid, following_id: userId });
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("user_follows")
      .delete()
      .eq("follower_id", uid)
      .eq("following_id", userId);
    if (error) throw error;
  }
}

// ---- hooks ----
export function useUserProfile(userId: string) {
  return useQuery({
    queryKey: qk.userProfile(userId),
    queryFn: () => getUserProfile(userId),
    enabled: Boolean(userId),
  });
}

export function useFollowCounts(userId: string) {
  return useQuery({
    queryKey: qk.followCounts(userId),
    queryFn: () => getFollowCounts(userId),
    enabled: Boolean(userId),
  });
}

export function useIsFollowing(userId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: qk.isFollowing(uid, userId),
    queryFn: () => getIsFollowing(uid, userId),
    enabled: Boolean(uid && userId && uid !== userId),
  });
}

export function useToggleFollow(userId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (on: boolean) => setFollow(uid, userId, on),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.isFollowing(uid, userId) });
      qc.invalidateQueries({ queryKey: qk.followCounts(userId) });
    },
  });
}
