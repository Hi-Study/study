import Link from "next/link";
import { getUnreadNotificationCount, getNotifications } from "@/lib/queries";
import { markNotificationsReadAction } from "@/lib/actions/discussions";
import { signOutAction } from "@/lib/actions/auth";
import { formatRelativeDate } from "@/lib/labels";
import { BrandMark } from "@/components/BrandLogo";

export async function TopBar({ userId, userName }: { userId: string; userName: string }) {
  const [unread, notifications] = await Promise.all([
    getUnreadNotificationCount(userId),
    getNotifications(userId),
  ]);

  return (
    <header className="sticky top-0 z-20 border-b border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-3">
        <Link href="/explore" className="flex items-center gap-2 text-lg font-bold text-neutral-900 dark:text-neutral-100">
          <BrandMark className="h-7 w-7" />
          테크 블로그 아카이빙
        </Link>

        <div className="flex items-center gap-3">
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full px-2 py-1 text-sm text-neutral-600 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800">
              🔔
              {unread > 0 ? (
                <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unread}
                </span>
              ) : null}
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-72 rounded-lg border border-neutral-200 bg-white p-2 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
              <div className="flex items-center justify-between px-2 py-1">
                <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-200">알림</span>
                {unread > 0 ? (
                  <form action={markNotificationsReadAction}>
                    <button type="submit" className="text-xs text-neutral-400 hover:underline">
                      모두 읽음
                    </button>
                  </form>
                ) : null}
              </div>
              <div className="max-h-80 overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-2 py-4 text-center text-sm text-neutral-400">알림이 없습니다</p>
                ) : (
                  notifications.map((n) => (
                    <Link
                      key={n.id}
                      href={n.link ?? "#"}
                      className={`block rounded-md px-2 py-2 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800 ${
                        n.readAt ? "text-neutral-400" : "text-neutral-800 dark:text-neutral-100"
                      }`}
                    >
                      <p className="line-clamp-2">{n.message}</p>
                      <p className="mt-0.5 text-xs text-neutral-400">{formatRelativeDate(n.createdAt)}</p>
                    </Link>
                  ))
                )}
              </div>
            </div>
          </details>

          <span className="hidden text-sm text-neutral-500 sm:inline dark:text-neutral-400">{userName}</span>

          <form action={signOutAction}>
            <button
              type="submit"
              className="rounded-full border border-neutral-300 px-3 py-1 text-xs text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
