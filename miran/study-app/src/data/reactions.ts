// distill 좋아요(reactions) — 글·의견·댓글에 좋아요. 글 like_count 는 DB 트리거가 유지.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { ReactionTarget } from "@/types/database";

export type { ReactionTarget };

// ---- raw ----
export async function getLiked(
  uid: string,
  targetType: ReactionTarget,
  targetId: string,
): Promise<boolean> {
  const { count, error } = await supabase
    .from("reactions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("target_type", targetType)
    .eq("target_id", targetId);
  if (error) throw error;
  return (count ?? 0) > 0;
}

export async function setLiked(
  uid: string,
  targetType: ReactionTarget,
  targetId: string,
  like: boolean,
): Promise<void> {
  if (like) {
    const { error } = await supabase.from("reactions").upsert(
      { user_id: uid, target_type: targetType, target_id: targetId },
      { onConflict: "user_id,target_type,target_id", ignoreDuplicates: true },
    );
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("user_id", uid)
      .eq("target_type", targetType)
      .eq("target_id", targetId);
    if (error) throw error;
  }
}

/** 목록에서 내가 좋아요한 target_id 집합(배치). */
export async function listLikedIds(
  uid: string,
  targetType: ReactionTarget,
  ids: string[],
): Promise<Set<string>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await supabase
    .from("reactions")
    .select("target_id")
    .eq("user_id", uid)
    .eq("target_type", targetType)
    .in("target_id", ids);
  if (error) throw error;
  return new Set((data ?? []).map((r: { target_id: string }) => r.target_id));
}

// ---- hooks ----
export function useLiked(targetType: ReactionTarget, targetId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: qk.liked(targetType, targetId, uid),
    queryFn: () => getLiked(uid, targetType, targetId),
    enabled: Boolean(targetId),
  });
}

/** 좋아요 토글 — mutate(현재 liked 값)을 넘기면 반대로 뒤집는다. */
export function useToggleReaction(targetType: ReactionTarget, targetId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (currentlyLiked: boolean) => setLiked(uid, targetType, targetId, !currentlyLiked),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.liked(targetType, targetId, uid) });
      if (targetType === "article") {
        qc.invalidateQueries({ queryKey: qk.article(targetId) });
        qc.invalidateQueries({ queryKey: qk.articles() }); // 목록 like_count 갱신
      } else if (targetType === "opinion") {
        qc.invalidateQueries({ queryKey: qk.opinion(targetId) });
        qc.invalidateQueries({ queryKey: qk.opinionsFeed() });
      } else if (targetType === "community") {
        qc.invalidateQueries({ queryKey: qk.communityPost(targetId) });
        qc.invalidateQueries({ queryKey: qk.communityPosts() });
      }
    },
  });
}
