// distill 원탭 스탬프(article_stamps) — 글을 다 읽고 버튼 하나만 누르는 반응.
//   인사이트 6칸을 못 쓰는 다수에게서 큐레이션 데이터를 얻는 통로다.
//   규약: 화면은 supabase 직접 호출 금지, 이 계층의 raw 함수/use* 훅만 사용.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { StampKind } from "@/types/database";

/** 글별 스탬프 집계 — { apply: 12, hard: 3, ... } (0 은 키가 없을 수 있다). */
export type StampCounts = Partial<Record<StampKind, number>>;

// ---- raw ----

/** 내가 이 글에 누른 스탬프 종류들. */
export async function listMyStamps(uid: string, articleId: string): Promise<StampKind[]> {
  const { data, error } = await supabase
    .from("article_stamps")
    .select("kind")
    .eq("user_id", uid)
    .eq("article_id", articleId);
  if (error) throw error;
  return (data ?? []).map((r) => r.kind as StampKind);
}

/** 글 하나의 스탬프 집계(남의 것 포함). */
export async function getStampCounts(articleId: string): Promise<StampCounts> {
  const { data, error } = await supabase.rpc("article_stamp_counts", {
    p_article_ids: [articleId],
  });
  if (error) throw error;
  const out: StampCounts = {};
  for (const row of (data ?? []) as { kind: StampKind; cnt: number }[]) {
    out[row.kind] = Number(row.cnt);
  }
  return out;
}

export async function addStamp(uid: string, articleId: string, kind: StampKind): Promise<void> {
  const { error } = await supabase
    .from("article_stamps")
    .upsert(
      { user_id: uid, article_id: articleId, kind },
      { onConflict: "user_id,article_id,kind" },
    );
  if (error) throw error;
}

export async function removeStamp(uid: string, articleId: string, kind: StampKind): Promise<void> {
  const { error } = await supabase
    .from("article_stamps")
    .delete()
    .eq("user_id", uid)
    .eq("article_id", articleId)
    .eq("kind", kind);
  if (error) throw error;
}

// ---- hooks ----

export function useMyStamps(articleId: string) {
  const uid = useUid();
  return useQuery({
    queryKey: qk.myStamps(uid, articleId),
    queryFn: () => listMyStamps(uid, articleId),
    enabled: Boolean(uid && articleId),
  });
}

export function useStampCounts(articleId: string) {
  return useQuery({
    queryKey: qk.stampCounts(articleId),
    queryFn: () => getStampCounts(articleId),
    enabled: Boolean(articleId),
  });
}

/** 스탬프 토글 — 이미 눌렀으면 취소. 1초 안에 끝나야 하는 동작이라 낙관적 갱신을 쓴다. */
export function useToggleStamp(articleId: string) {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ kind, on }: { kind: StampKind; on: boolean }) => {
      if (on) await addStamp(uid, articleId, kind);
      else await removeStamp(uid, articleId, kind);
    },
    onMutate: async ({ kind, on }) => {
      const key = qk.myStamps(uid, articleId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<StampKind[]>(key) ?? [];
      qc.setQueryData<StampKind[]>(key, on ? [...prev, kind] : prev.filter((k) => k !== kind));
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.myStamps(uid, articleId), ctx.prev);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: qk.myStamps(uid, articleId) });
      qc.invalidateQueries({ queryKey: qk.stampCounts(articleId) });
    },
  });
}
