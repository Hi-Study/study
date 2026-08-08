"use client";

import { useOptimistic, useTransition } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { toggleBookmark } from "@/app/actions";
import type { FeedPost } from "@/lib/types";

function dateLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return "이번주";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function PostCard({ post, highlightTalk }: { post: FeedPost; highlightTalk?: boolean }) {
  const [, startTransition] = useTransition();
  const [optimisticBookmarked, setOptimisticBookmarked] = useOptimistic(post.bookmarked);

  function handleBookmark() {
    startTransition(async () => {
      setOptimisticBookmarked(!optimisticBookmarked);
      await toggleBookmark(post.id);
    });
  }

  const hot = highlightTalk && post.talkCount > 0;

  return (
    <div className="card">
      <Link href={`/post/${post.id}`} className="card-open">
        <div className="thumb">
          <Icon name={(post.icon as never) || "link"} />
        </div>
        <div className="card-body">
          <div className="card-title">{post.title}</div>
          <div className="card-snippet">{post.paragraphs?.[0] || ""}</div>
          <div className="meta-line">
            <span className="src">{post.source}</span>
            <span>·</span>
            <span>{post.sharer?.name}</span>
            <span>·</span>
            <span>{dateLabel(post.created_at)}</span>
          </div>
          <div className="tag-row">
            {post.tags.map((t) => (
              <span className="tag" key={t}>
                {t}
              </span>
            ))}
          </div>
          <div className="card-actions">
            <span className={`talk-count${hot ? " hot" : ""}`}>
              <Icon name="sparkle" />
              {post.talkCount}
            </span>
            <span className="comment-count">
              <Icon name="comment" />
              {post.commentCount}
            </span>
          </div>
        </div>
      </Link>
      <button
        className={`bookmark-btn${optimisticBookmarked ? " saved" : ""}`}
        onClick={handleBookmark}
        aria-label={optimisticBookmarked ? "북마크 해제" : "북마크"}
      >
        <Icon name="bookmark" filled={optimisticBookmarked} />
      </button>
    </div>
  );
}
