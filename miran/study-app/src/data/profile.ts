import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { ThemeMode } from "@/theme";
import type { UserRow } from "@/types/tables";

// ---- raw ----
export async function getProfile(uid: string): Promise<UserRow> {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("id", uid)
    .single();
  if (error) throw error;
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
