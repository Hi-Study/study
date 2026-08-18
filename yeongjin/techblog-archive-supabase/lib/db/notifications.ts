import { createClient } from "@/lib/supabase/server";
import { randomUUID } from "crypto";
import { readCollection, writeCollection } from "./local-store";

const USE_SUPABASE = process.env.DATA_BACKEND === "supabase";

// 알림(PRD 2. 공통 UI) — 좋아요한 기업의 새 글 / 내 독후감의 댓글 / 대댓글, 3종.
export type NotificationType = "new_article" | "note_comment" | "reply";

export type NotificationRecord = {
  id: string;
  user_key: string;
  type: NotificationType;
  message: string;
  article_id: string;
  read: boolean;
  created_at: string;
};

export async function createNotification(input: {
  userKey: string;
  type: NotificationType;
  message: string;
  articleId: string;
}): Promise<void> {
  const record: NotificationRecord = {
    id: randomUUID(),
    user_key: input.userKey,
    type: input.type,
    message: input.message,
    article_id: input.articleId,
    read: false,
    created_at: new Date().toISOString(),
  };

  if (USE_SUPABASE) {
    const supabase = await createClient();
    await supabase.from("notifications").insert({
      user_key: record.user_key,
      type: record.type,
      message: record.message,
      article_id: record.article_id,
    });
    return;
  }

  const items = await readCollection<NotificationRecord>("notifications");
  items.push(record);
  await writeCollection("notifications", items);
}

export async function listNotificationsByUser(
  userKey: string,
  limit = 30,
): Promise<NotificationRecord[]> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_key", userKey)
      .order("created_at", { ascending: false })
      .limit(limit);
    return (data as NotificationRecord[]) ?? [];
  }
  const items = await readCollection<NotificationRecord>("notifications");
  return items
    .filter((n) => n.user_key === userKey)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}

export async function markAllNotificationsRead(userKey: string): Promise<void> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    await supabase.from("notifications").update({ read: true }).eq("user_key", userKey).eq("read", false);
    return;
  }
  const items = await readCollection<NotificationRecord>("notifications");
  const next = items.map((n) => (n.user_key === userKey ? { ...n, read: true } : n));
  await writeCollection("notifications", next);
}

export async function setNotificationRead(
  id: string,
  userKey: string,
  read: boolean,
): Promise<void> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    await supabase.from("notifications").update({ read }).eq("id", id).eq("user_key", userKey);
    return;
  }
  const items = await readCollection<NotificationRecord>("notifications");
  const idx = items.findIndex((n) => n.id === id && n.user_key === userKey);
  if (idx === -1) return;
  items[idx] = { ...items[idx], read };
  await writeCollection("notifications", items);
}

export async function deleteNotification(id: string, userKey: string): Promise<void> {
  if (USE_SUPABASE) {
    const supabase = await createClient();
    await supabase.from("notifications").delete().eq("id", id).eq("user_key", userKey);
    return;
  }
  const items = await readCollection<NotificationRecord>("notifications");
  const next = items.filter((n) => !(n.id === id && n.user_key === userKey));
  await writeCollection("notifications", next);
}
