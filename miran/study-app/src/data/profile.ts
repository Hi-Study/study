import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { ThemeMode } from "@/theme";
import type { UserRow } from "@/types/tables";

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
