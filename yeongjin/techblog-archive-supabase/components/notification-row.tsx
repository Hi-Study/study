"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { NotificationRecord } from "@/lib/db/notifications";
import { cn } from "@/lib/utils";
import { MessageCircle, MoreVertical, Rss } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const TYPE_LABEL: Record<NotificationRecord["type"], string> = {
  new_article: "기업 소식",
  note_comment: "댓글",
  reply: "댓글",
};

function formatRelativeTime(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return "방금";
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export function NotificationRow({ notification }: { notification: NotificationRecord }) {
  const [read, setRead] = useState(notification.read);
  const [removed, setRemoved] = useState(false);

  const toggleRead = async () => {
    const next = !read;
    setRead(next);
    await fetch(`/api/notifications/${notification.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: next }),
    });
  };

  const remove = async () => {
    setRemoved(true);
    await fetch(`/api/notifications/${notification.id}`, { method: "DELETE" });
  };

  if (removed) return null;

  const isComment = notification.type !== "new_article";

  return (
    <div className={cn("flex items-start gap-3 border-b p-4", !read && "bg-primary/5")}>
      <div
        className={cn(
          "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
          isComment ? "bg-highlight/15 text-highlight" : "bg-primary/15 text-primary",
        )}
      >
        {isComment ? <MessageCircle className="h-5 w-5" /> : <Rss className="h-5 w-5" />}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold">{formatRelativeTime(notification.created_at)}</span>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleRead}
              aria-pressed={read}
              aria-label={read ? "읽음" : "안 읽음"}
              className={cn(
                "relative h-5 w-9 rounded-full transition-colors",
                read ? "bg-primary" : "border bg-muted",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 h-4 w-4 rounded-full bg-background transition-transform",
                  read ? "translate-x-4" : "translate-x-0.5",
                )}
              />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger aria-label="더보기">
                <MoreVertical className="h-4 w-4 text-muted-foreground" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={remove} className="text-destructive">
                  삭제
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{TYPE_LABEL[notification.type]}</p>
        <Link
          href={`/articles/${notification.article_id}`}
          className="mt-1 block line-clamp-2 text-sm hover:underline"
        >
          {notification.message}
        </Link>
      </div>
    </div>
  );
}
