import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useUid } from "@/auth/AuthProvider";
import type { LikeTarget } from "@/types/database";

export interface LikeInfo {
  count: number;
  liked: boolean;
}

// ---- raw ----
export async function getLikeInfo(
  uid: string,
  targetType: LikeTarget,
  targetId: string,
): Promise<LikeInfo> {
  const [{ count, error: cErr }, { data: mine, error: mErr }] = await Promise.all([
    supabase
      .from("likes")
      .select("*", { count: "exact", head: true })
      .eq("target_type", targetType)
      .eq("target_id", targetId),
    supabase
      .from("likes")
      .select("user_id")
      .eq("target_type", targetType)
      .eq("target_id", targetId)
      .eq("user_id", uid)
      .maybeSingle(),
  ]);
  if (cErr) throw cErr;
  if (mErr) throw mErr;
  return { count: count ?? 0, liked: Boolean(mine) };
}

export async function toggleLike(
  uid: string,
  studyId: string,
  targetType: LikeTarget,
  targetId: string,
  liked: boolean,
): Promise<void> {
  if (liked) {
    const { error } = await supabase
      .from("likes")
      .delete()
      .eq("user_id", uid)
      .eq("target_type", targetType)
      .eq("target_id", targetId);
    if (error) throw error;
  } else {
    const { error } = await supabase.from("likes").insert({
      user_id: uid,
      study_id: studyId,
      target_type: targetType,
      target_id: targetId,
    });
    if (error) throw error;
  }
}

// ---- hooks ----
const likeKey = (t: LikeTarget, id: string) => ["like", t, id] as const;

export function useLikeInfo(targetType: LikeTarget, targetId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: likeKey(targetType, targetId),
    queryFn: () => getLikeInfo(uid, targetType, targetId),
    enabled: Boolean(targetId),
  });
}

export function useToggleLike(
  studyId: string,
  targetType: LikeTarget,
  targetId: string,
) {
  const uid = useUid();
  const qc = useQueryClient();
  const key = likeKey(targetType, targetId);
  return useMutation({
    mutationFn: (liked: boolean) =>
      toggleLike(uid, studyId, targetType, targetId, liked),
    // 낙관적 업데이트: 즉시 토글 반영 후 실패 시 롤백.
    onMutate: async (liked) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<LikeInfo>(key);
      if (prev) {
        qc.setQueryData<LikeInfo>(key, {
          liked: !liked,
          count: prev.count + (liked ? -1 : 1),
        });
      }
      return { prev };
    },
    onError: (_e, _liked, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
