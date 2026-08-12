// distill 알림(app_notifications) — 즐겨찾기 기업 새 글 · 내 의견 댓글 · 대댓글. 본인만.
//   생성은 DB 트리거가 담당(스키마 §15). 앱은 조회 + 읽음 처리만.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/lib/supabase";
import { qk } from "@/lib/queryKeys";
import { useUid } from "@/auth/AuthProvider";

export type NotificationKind = "new_article" | "comment" | "reply";

export interface AppNotificationRow {
  id: string;
  kind: NotificationKind;
  article_id: string | null;
  opinion_id: string | null;
  title: string;
  read: boolean;
  created_at: string;
}

// ---- raw ----
export async function listAppNotifications(uid: string): Promise<AppNotificationRow[]> {
  const { data, error } = await supabase
    .from("app_notifications")
    .select("id, kind, article_id, opinion_id, title, read, created_at")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as unknown as AppNotificationRow[];
}

export async function countUnreadNotifications(uid: string): Promise<number> {
  const { count, error } = await supabase
    .from("app_notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", uid)
    .eq("read", false);
  if (error) throw error;
  return count ?? 0;
}

export async function markAllNotificationsRead(uid: string): Promise<void> {
  const { error } = await supabase
    .from("app_notifications")
    .update({ read: true })
    .eq("user_id", uid)
    .eq("read", false);
  if (error) throw error;
}

// ---- hooks ----
export function useAppNotifications() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.appNotifications(uid),
    queryFn: () => listAppNotifications(uid),
    enabled: Boolean(uid),
  });
}

export function useUnreadNotificationCount() {
  const uid = useUid();
  return useQuery({
    queryKey: qk.appNotificationsUnread(uid),
    queryFn: () => countUnreadNotifications(uid),
    enabled: Boolean(uid),
  });
}

export function useMarkAllNotificationsRead() {
  const uid = useUid();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => markAllNotificationsRead(uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.appNotifications(uid) });
      qc.invalidateQueries({ queryKey: qk.appNotificationsUnread(uid) });
    },
  });
}
