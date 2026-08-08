"use client";

import { useState } from "react";
import { markNotificationRead } from "@/app/actions";
import type { NotificationRow } from "@/lib/types";

function timeAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "방금";
  if (mins < 60) return `${mins}분 전`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "어제";
  return `${days}일 전`;
}

export default function NotificationsClient({ notifications }: { notifications: NotificationRow[] }) {
  const [tab, setTab] = useState<"all" | "unread">("all");
  const unreadCount = notifications.filter((n) => !n.read).length;
  const shown = tab === "unread" ? notifications.filter((n) => !n.read) : notifications;

  return (
    <>
      <div className="segment">
        <button className={tab === "all" ? "active" : ""} onClick={() => setTab("all")}>
          전체
        </button>
        <button className={tab === "unread" ? "active" : ""} onClick={() => setTab("unread")}>
          안읽음 {unreadCount}
        </button>
      </div>
      <div className="content">
        {shown.length === 0 && <div className="empty-state">알림이 없어요</div>}
        {shown.map((n) => (
          <form key={n.id} action={markNotificationRead.bind(null, n.id, n.post_id)}>
            <button type="submit" className="notif-item">
              <div className="notif-dot-col">{!n.read && <span className="notif-dot" />}</div>
              <div className="notif-body">
                <div className="notif-text">
                  <b>{n.profiles?.name}</b>님이 {n.action}
                </div>
                <div className="notif-snippet">{n.snippet}</div>
                <div className="notif-time">{timeAgo(n.created_at)}</div>
              </div>
            </button>
          </form>
        ))}
      </div>
    </>
  );
}
