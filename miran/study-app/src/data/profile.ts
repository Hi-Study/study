import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { ThemeMode } from "@/theme";
import type { UserRow } from "@/types/tables";
import type { JobRole, Topic } from "@/types/database";

/** 구글 로그인 세션 메타데이터에서 표시 이름 추출(없으면 이메일 아이디, 그래도 없으면 null). */
export function nameFromSession(session: Session | null): string | null {
  const m = (session?.user?.user_metadata ?? {}) as Record<string, unknown>;
  for (const key of ["full_name", "name", "user_name"]) {
    const v = m[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  const email = session?.user?.email;
  if (email && email.includes("@")) return email.split("@")[0];
  return null;
}

// ---- raw ----
export async function getProfile(uid: string): Promise<UserRow> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .single();
  if (error) throw error;
  // 구글 로그인 이름 보정: users.name 이 비었거나 기본값 '게스트'면 세션 이름으로 1회 갱신.
  const current = data.name?.trim();
  if (!current || current === "게스트") {
    const { data: s } = await supabase.auth.getSession();
    const name = nameFromSession(s.session);
    if (name && name !== current) {
      const { data: updated } = await supabase
        .from("users")
        .update({ name })
        .eq("id", uid)
        .select("*")
        .single();
      if (updated) return updated;
    }
  }
  return data;
}

export interface ProfilePatch {
  name?: string;
  role_title?: string | null;
  job_role?: JobRole | null;
}

export async function updateProfile(
  uid: string,
  patch: ProfilePatch,
): Promise<UserRow> {
  const { data, error } = await supabase
    .from("users")
    .update(patch)
    .eq("id", uid)
    .select("*")
    .single();
  if (error) throw error;
  return data;
}

export async function setTheme(uid: string, theme: ThemeMode): Promise<void> {
  const { error } = await supabase.from("users").update({ theme }).eq("id", uid);
  if (error) throw error;
}

// ---- hooks ----
export function useProfile() {
  const uid = useUid();
  return useQuery({ queryKey: qk.profile(uid), queryFn: () => getProfile(uid) });
}

export function useUpdateProfile() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => updateProfile(uid, patch),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile(uid) }),
  });
}

export function useSetTheme() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (theme: ThemeMode) => setTheme(uid, theme),
    onSuccess: () => qc.invalidateQueries({ queryKey: qk.profile(uid) }),
  });
}

// ---- 온보딩(직무 · 관심 주제) ----
//
// 구글 로그인 직후 1화면에서 직무를 받는다. 이 값 하나로
//   ① 역할별 AI 요약  ② 직군 배지("기획자 12명이 읽었어요")  ③ 단어장 개인화
// 가 전부 돌아간다. onboarded_at 이 채워지면 온보딩 화면을 다시 띄우지 않는다.

export interface OnboardingInput {
  jobRole: JobRole;
  topics: Topic[];
}

/** 직무 + 관심 주제를 저장하고 온보딩 완료로 표시. */
export async function completeOnboarding(uid: string, input: OnboardingInput): Promise<UserRow> {
  const { data, error } = await supabase
    .from("users")
    .update({ job_role: input.jobRole, onboarded_at: new Date().toISOString() })
    .eq("id", uid)
    .select("*")
    .single();
  if (error) throw error;

  // 관심 주제는 통째로 교체(온보딩에서 고른 것이 최종).
  await supabase.from("user_topics").delete().eq("user_id", uid);
  if (input.topics.length > 0) {
    const { error: tErr } = await supabase
      .from("user_topics")
      .insert(input.topics.map((topic) => ({ user_id: uid, topic })));
    if (tErr) throw tErr;
  }
  return data;
}

export async function listMyTopics(uid: string): Promise<Topic[]> {
  const { data, error } = await supabase.from("user_topics").select("topic").eq("user_id", uid);
  if (error) throw error;
  return (data ?? []).map((r) => r.topic as Topic);
}

export function useMyTopics() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.myTopics(uid),
    queryFn: () => listMyTopics(uid),
    enabled: Boolean(uid),
  });
}

export function useCompleteOnboarding() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: OnboardingInput) => completeOnboarding(uid, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.profile(uid) });
      qc.invalidateQueries({ queryKey: qk.myTopics(uid) });
    },
  });
}
