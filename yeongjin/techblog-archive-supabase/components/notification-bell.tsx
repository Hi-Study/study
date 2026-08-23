"use client";

import type { NotificationRecord } from "@/lib/db/notifications";
import { Bell } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    fetch("/api/notifications")
      .then((res) => (res.ok ? res.json() : { notifications: [] }))
      .then((data: { notifications?: NotificationRecord[] }) => {
        setUnreadCount((data.notifications ?? []).filter((n) => !n.read).length);
      })
      .catch(() => {});
  }, []);

  return (
    <Link href="/notifications" aria-label="알림" className="relative">
      <Bell className="h-5 w-5" />
      {unreadCount > 0 ? (
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-destructive-foreground">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      ) : null}
    </Link>
  );
}
