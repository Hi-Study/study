import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";

export interface DashboardStats {
  studyCount: number;
  shareCount: number;
  commentCount: number;
  pendingCount: number; // 이번 주 active 토론 중 내 의견 없는 것
}

// ---- raw ----
/** weekStart: 이번 주 월요일 'YYYY-MM-DD' (호출부에서 계산해 전달). */
export async function getDashboard(
  uid: string,
  weekStart: string,
): Promise<DashboardStats> {
  const [studies, shares, comments] = await Promise.all([
    supabase
      .from("study_members")
      .select("*", { count: "exact", head: true })
      .eq("user_id", uid),
    supabase
      .from("shares")
      .select("*", { count: "exact", head: true })
      .eq("author_id", uid),
    supabase
      .from("comments")
      .select("*", { count: "exact", head: true })
      .eq("author_id", uid),
  ]);
  if (studies.error) throw studies.error;
  if (shares.error) throw shares.error;
  if (comments.error) throw comments.error;

  // 미참여 판정: 이번 주 active 토론 - 내가 댓글 단 토론.
  const { data: active, error: aErr } = await supabase
    .from("discussions")
    .select("id")
    .eq("is_active", true)
    .eq("week_start", weekStart);
  if (aErr) throw aErr;

  const activeIds = (active ?? []).map((d) => d.id);
  let pendingCount = 0;
  if (activeIds.length > 0) {
    const { data: mine, error: mErr } = await supabase
      .from("comments")
      .select("target_id")
      .eq("author_id", uid)
      .eq("target_type", "discussion")
      .in("target_id", activeIds);
    if (mErr) throw mErr;
    const commented = new Set((mine ?? []).map((c) => c.target_id));
    pendingCount = activeIds.filter((id) => !commented.has(id)).length;
  }

  return {
    studyCount: studies.count ?? 0,
    shareCount: shares.count ?? 0,
    commentCount: comments.count ?? 0,
    pendingCount,
  };
}

// ---- 내 활동 리스트 ----
export interface ActivityItem {
  id: string;
  kind: "share" | "comment";
  text: string;
  created_at: string;
  studyId: string;
  targetType: "share" | "discussion"; // 이동 대상 종류
  targetId: string; // 이동 대상 id
}

export async function getMyActivity(uid: string): Promise<ActivityItem[]> {
  const [shares, comments] = await Promise.all([
    supabase
      .from("shares")
      .select("id, title, created_at, study_id")
      .eq("author_id", uid)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("comments")
      .select("id, text, created_at, study_id, target_type, target_id")
      .eq("author_id", uid)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  if (shares.error) throw shares.error;
  if (comments.error) throw comments.error;

  const items: ActivityItem[] = [
    ...(shares.data ?? []).map((s) => ({
      id: `s${s.id}`,
      kind: "share" as const,
      text: `글 공유 — ${s.title}`,
      created_at: s.created_at,
      studyId: s.study_id,
      targetType: "share" as const,
      targetId: s.id,
    })),
    ...(comments.data ?? []).map((c) => ({
      id: `c${c.id}`,
      kind: "comment" as const,
      text: `${c.target_type === "share" ? "글" : "토론"}에 댓글 — ${c.text}`,
      created_at: c.created_at,
      studyId: c.study_id,
      targetType: c.target_type as "share" | "discussion",
      targetId: c.target_id,
    })),
  ];
  items.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return items.slice(0, 20);
}

// ---- hooks ----
export function useDashboard(weekStart: string) {
  const uid = useUid();
  return useQuery({
    queryKey: [...qk.dashboard(), weekStart] as const,
    queryFn: () => getDashboard(uid, weekStart),
    enabled: Boolean(weekStart),
  });
}

export function useMyActivity() {
  const uid = useUid();
  return useQuery({
    queryKey: ["myActivity", uid] as const,
    queryFn: () => getMyActivity(uid),
  });
}

// ---- 미참여 토론 리스트 ----
export interface PendingDiscussion {
  id: string;
  title: string;
  studyId: string;
}

export async function getPendingDiscussions(uid: string): Promise<PendingDiscussion[]> {
  const { data: mem, error: mErr } = await supabase
    .from("study_members")
    .select("study_id")
    .eq("user_id", uid);
  if (mErr) throw mErr;
  const studyIds = (mem ?? []).map((m) => m.study_id);
  if (studyIds.length === 0) return [];

  const { data: discs, error: dErr } = await supabase
    .from("discussions")
    .select("id, title, study_id")
    .in("study_id", studyIds)
    .eq("is_active", true);
  if (dErr) throw dErr;
  const discIds = (discs ?? []).map((d) => d.id);
  if (discIds.length === 0) return [];

  const { data: mine, error: cErr } = await supabase
    .from("comments")
    .select("target_id")
    .eq("target_type", "discussion")
    .eq("author_id", uid)
    .in("target_id", discIds);
  if (cErr) throw cErr;
  const commented = new Set((mine ?? []).map((c) => c.target_id));

  return (discs ?? [])
    .filter((d) => !commented.has(d.id))
    .map((d) => ({ id: d.id, title: d.title, studyId: d.study_id }));
}

export function usePendingDiscussions() {
  const uid = useUid();
  return useQuery({
    queryKey: ["pendingDiscussions", uid] as const,
    queryFn: () => getPendingDiscussions(uid),
  });
}
