import { createClient } from "@/lib/supabase/server";
import BackButton from "@/components/BackButton";
import NotificationsClient from "@/components/NotificationsClient";

export const dynamic = "force-dynamic";

export default async function NotificationsPage() {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();

  const { data } = await sb
    .from("notifications")
    .select("id, type, title, body, read, created_at")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: false })
    .limit(50);

  // 조회 시 읽음 처리
  await sb.from("notifications").update({ read: true }).eq("user_id", user!.id).eq("read", false);

  return (
    <div className="screen">
      <div className="appbar"><BackButton /><span className="title">알림</span></div>
      <NotificationsClient items={data ?? []} />
    </div>
  );
}
