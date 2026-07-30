import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";
import type { NotificationRow } from "@/types/tables";

// ---- raw ----
export async function listNotifications(uid: string): Promise<NotificationRow[]> {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function markRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", id);
  if (error) throw error;
}

export async function markAllRead(uid: string): Promise<void> {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", uid)
    .eq("is_read", false);
  if (error) throw error;
}

export async function countUnread(uid: string): Promise<number> {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("is_read", false);
  if (error) throw error;
  return count ?? 0;
}

// ---- hooks ----
export function useNotifications() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.notifications(),
    queryFn: () => listNotifications(uid),
  });
}

/** 벨 아이콘 안읽음 표시용. */
export function useUnreadNotifications() {
  const uid = useUid();
  return useQuery({
    queryKey: ["notifUnread", uid] as const,
    queryFn: () => countUnread(uid),
  });
}

function invalidateNotif(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: qk.notifications() });
  qc.invalidateQueries({ queryKey: ["notifUnread"] });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: markRead,
    onSuccess: () => invalidateNotif(qc),
  });
}

export function useMarkAllRead() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllRead(uid),
    onSuccess: () => invalidateNotif(qc),
  });
}
