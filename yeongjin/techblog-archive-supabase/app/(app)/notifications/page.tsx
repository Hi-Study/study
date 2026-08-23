import { BackButton } from "@/components/back-button";
import { EmptyState } from "@/components/empty-state";
import { MarkAllReadButton } from "@/components/mark-all-read-button";
import { NotificationRow } from "@/components/notification-row";
import { UnderlineTabs } from "@/components/underline-tabs";
import { PREVIEW_USER_KEY } from "@/lib/db/bookmarks";
import { listNotificationsByUser } from "@/lib/db/notifications";
import { createClient } from "@/lib/supabase/server";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

const TABS = [
  { key: "company", label: "기업 소식" },
  { key: "comments", label: "댓글" },
] as const;

export const dynamic = "force-dynamic";

export default async function NotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const activeTab = tab === "comments" ? "comments" : "company";

  let userKey = PREVIEW_USER_KEY;
  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) userKey = user.id;
  }

  const all = await listNotificationsByUser(userKey);
  const items = all.filter((n) =>
    activeTab === "company" ? n.type === "new_article" : n.type !== "new_article",
  );

  return (
    <div>
      <header className="sticky top-0 z-40 border-b bg-background pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2 p-4 pb-0">
          <BackButton />
          <h1 className="text-lg font-semibold">알림</h1>
        </div>

        <div className="mt-3 flex items-center justify-between px-4">
          <UnderlineTabs
            items={TABS.map((t) => ({
              key: t.key,
              label: t.label,
              href: `/notifications?tab=${t.key}`,
              active: activeTab === t.key,
            }))}
          />
          <div className="pb-3">
            <MarkAllReadButton />
          </div>
        </div>
      </header>

      {items.length === 0 ? (
        <EmptyState
          message={
            activeTab === "company"
              ? "좋아요한 기업의 새 글 소식이 아직 없어요."
              : "댓글·대댓글 알림이 아직 없어요."
          }
        />
      ) : (
        <div>
          {items.map((n) => (
            <NotificationRow key={n.id} notification={n} />
          ))}
        </div>
      )}
    </div>
  );
}
