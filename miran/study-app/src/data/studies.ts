import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { MemberRole } from "@/types/database";
import type { StudyRow, UserRow } from "@/types/tables";

export interface MyStudy {
  role: MemberRole;
  joined_at: string;
  study: StudyRow;
  /** 홈 목록 부가정보 (집계) */
  memberCount: number;
  activeTopic: string | null; // 이번 주 진행 중 토론 제목
  unreadCount: number; // 내가 의견 안 남긴 진행 중 토론 수
}

export interface MemberWithUser {
  role: MemberRole;
  joined_at: string;
  user: UserRow;
}

// ---- raw ----
export async function listMyStudies(uid: string): Promise<MyStudy[]> {
  const { data, error } = await supabase
    .from("study_members")
    .select("role, joined_at, study:studies(*)")
    .eq("user_id", uid)
    .order("joined_at", { ascending: false });
  if (error) throw error;
  // 임베디드 관계 타이핑(수기 Database) 한계로 캐스팅.
  const rows = (data ?? []) as unknown as MyStudy[];
  const ids = rows.map((r) => r.study.id);
  if (ids.length === 0) return rows;

  // 멤버 수 + 진행 중 토론 + 내 참여 여부를 배치로 집계 (N+1 회피)
  const [memRes, discRes] = await Promise.all([
    supabase.from("study_members").select("study_id").in("study_id", ids),
    supabase
      .from("discussions")
      .select("id, study_id, title")
      .in("study_id", ids)
      .eq("is_active", true),
  ]);
  if (memRes.error) throw memRes.error;
  if (discRes.error) throw discRes.error;

  const memberCount: Record<string, number> = {};
  for (const m of memRes.data ?? []) {
    memberCount[m.study_id] = (memberCount[m.study_id] ?? 0) + 1;
  }

  const activeByStudy: Record<string, { id: string; title: string }[]> = {};
  const activeIds: string[] = [];
  for (const d of discRes.data ?? []) {
    (activeByStudy[d.study_id] ||= []).push({ id: d.id, title: d.title });
    activeIds.push(d.id);
  }

  const mineSet = new Set<string>();
  if (activeIds.length > 0) {
    const { data: mine, error: mErr } = await supabase
      .from("comments")
      .select("target_id")
      .eq("target_type", "discussion")
      .eq("author_id", uid)
      .in("target_id", activeIds);
    if (mErr) throw mErr;
    for (const cmt of mine ?? []) mineSet.add(cmt.target_id);
  }

  return rows.map((r) => {
    const active = activeByStudy[r.study.id] ?? [];
    return {
      ...r,
      memberCount: memberCount[r.study.id] ?? 0,
      activeTopic: active[0]?.title ?? null,
      unreadCount: active.filter((a) => !mineSet.has(a.id)).length,
    };
  });
}

export async function getStudy(studyId: string): Promise<StudyRow> {
  const { data, error } = await supabase
    .from("studies")
    .select("*")
    .eq("id", studyId)
    .single();
  if (error) throw error;
  return data;
}

export async function listMembers(studyId: string): Promise<MemberWithUser[]> {
  const { data, error } = await supabase
    .from("study_members")
    .select("role, joined_at, user:users(*)")
    .eq("study_id", studyId)
    .order("joined_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as unknown as MemberWithUser[];
}

export async function createStudy(input: {
  name: string;
  description?: string | null;
  cadence?: string;
}): Promise<string> {
  const { data, error } = await supabase.rpc("create_study", {
    _name: input.name,
    _description: input.description ?? null,
    _cadence: input.cadence ?? "주 2회",
  });
  if (error) throw error;
  return data as string;
}

export interface JoinResult {
  status: "joined" | "already_member";
  study_id: string;
}

export async function joinByCode(code: string): Promise<JoinResult> {
  const { data, error } = await supabase.rpc("join_by_code", { _code: code });
  if (error) throw error;
  return data as unknown as JoinResult;
}

export async function updateStudy(
  studyId: string,
  patch: { name?: string; description?: string | null; share_cadence?: string },
): Promise<void> {
  const { error } = await supabase.from("studies").update(patch).eq("id", studyId);
  if (error) throw error;
}

export async function regenerateInviteCode(studyId: string): Promise<string> {
  const { data, error } = await supabase.rpc("regenerate_invite_code", {
    _study: studyId,
  });
  if (error) throw error;
  return data as string;
}

export async function delegateOwner(studyId: string, target: string): Promise<void> {
  const { error } = await supabase.rpc("delegate_owner", {
    _study: studyId,
    _target: target,
  });
  if (error) throw error;
}

export async function leaveStudy(studyId: string): Promise<void> {
  const { error } = await supabase.rpc("leave_study", { _study: studyId });
  if (error) throw error;
}

export async function kickMember(studyId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("study_members")
    .delete()
    .eq("study_id", studyId)
    .eq("user_id", userId);
  if (error) throw error;
}

/** 스터디 삭제(cascade). RLS 상 owner 만 가능. */
export async function deleteStudy(studyId: string): Promise<void> {
  const { error } = await supabase.from("studies").delete().eq("id", studyId);
  if (error) throw error;
}

// ---- hooks ----
export function useMyStudies() {
  const uid = useUid();
  return useQuery({ queryKey: qk.myStudies(), queryFn: () => listMyStudies(uid) });
}

export function useStudy(studyId: string) {
  return useQuery({
    queryKey: qk.study(studyId),
    queryFn: () => getStudy(studyId),
    enabled: Boolean(studyId),
  });
}

export function useMembers(studyId: string) {
  return useQuery({
    queryKey: qk.members(studyId),
    queryFn: () => listMembers(studyId),
    enabled: Boolean(studyId),
  });
}

export function useCreateStudy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: createStudy,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myStudies() }),
  });
}

export function useJoinByCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: joinByCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myStudies() }),
  });
}

export function useUpdateStudy(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: Parameters<typeof updateStudy>[1]) =>
      updateStudy(studyId, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.study(studyId) }),
  });
}

export function useRegenerateCode(studyId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => regenerateInviteCode(studyId),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.study(studyId) }),
  });
}

export function useDeleteStudy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: deleteStudy,
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.myStudies() }),
  });
}

export function useMemberActions(studyId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: qk.members(studyId) });
    qc.invalidateQueries({ queryKey: qk.myStudies() });
  };
  return {
    delegate: useMutation({
      mutationFn: (target: string) => delegateOwner(studyId, target),
      onSuccess: invalidate,
    }),
    kick: useMutation({
      mutationFn: (userId: string) => kickMember(studyId, userId),
      onSuccess: invalidate,
    }),
    leave: useMutation({
      mutationFn: () => leaveStudy(studyId),
      onSuccess: invalidate,
    }),
  };
}
