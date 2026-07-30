import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { useUid } from "@/auth/AuthProvider";

export interface DiscussVoteInfo {
  count: number;
  voted: boolean;
}

// ---- raw ----
export async function getDiscussVoteInfo(uid: string, shareId: string): Promise<DiscussVoteInfo> {
  const [{ count, error: cErr }, { data: mine, error: mErr }] = await Promise.all([
    supabase.from("discuss_votes").select("*", { count: "exact", head: true }).eq("share_id", shareId),
    supabase
      .from("discuss_votes")
      .select("user_id")
      .eq("share_id", shareId)
      .eq("user_id", uid)
      .maybeSingle(),
  ]);
  if (cErr) throw cErr;
  if (mErr) throw mErr;
  return { count: count ?? 0, voted: Boolean(mine) };
}

export async function toggleDiscussVote(
  uid: string,
  studyId: string,
  shareId: string,
  voted: boolean,
): Promise<void> {
  if (voted) {
    const { error } = await supabase
      .from("discuss_votes")
      .delete()
      .eq("user_id", uid)
      .eq("share_id", shareId);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("discuss_votes")
      .insert({ user_id: uid, study_id: studyId, share_id: shareId });
    if (error) throw error;
  }
}

// ---- hooks ----
const voteKey = (id: string) => ["discussVote", id] as const;

export function useDiscussVoteInfo(shareId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: voteKey(shareId),
    queryFn: () => getDiscussVoteInfo(uid, shareId),
    enabled: Boolean(shareId),
  });
}

export function useToggleDiscussVote(studyId: string, shareId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  const key = voteKey(shareId);
  return useMutation({
    mutationFn: (voted: boolean) => toggleDiscussVote(uid, studyId, shareId, voted),
    onMutate: async (voted) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<DiscussVoteInfo>(key);
      if (prev) {
        qc.setQueryData<DiscussVoteInfo>(key, {
          voted: !voted,
          count: prev.count + (voted ? -1 : 1),
        });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}
