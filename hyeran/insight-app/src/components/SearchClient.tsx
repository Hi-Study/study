"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import { toggleBookmark } from "@/app/actions";
import { useOptimistic, useTransition } from "react";
import type { FeedPost } from "@/lib/types";

const TAGS = ["우선순위", "로드맵", "OKR", "리서치", "UX", "데이터", "조직", "도구", "커리어", "전략", "프로덕트"];

function highlight(text: string, query: string) {
  if (!query) return text;
  const idx = text.indexOf(query);
  if (idx === -1) return text;
  return (
    <>
      {text.slice(0, idx)}
      <mark>{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  );
}

function CompactCard({ post, query }: { post: FeedPost; query: string }) {
  const [, startTransition] = useTransition();
  const [bookmarked, setBookmarked] = useOptimistic(post.bookmarked);

  return (
    <div className="compact-card">
      <Link href={`/post/${post.id}`} className="compact-card-main">
        <div className="compact-thumb">
          <Icon name={(post.icon as never) || "link"} />
        </div>
        <div className="compact-body">
          <div className="compact-title">{highlight(post.title, query)}</div>
          <div className="compact-meta">
            <span className="src" style={{ color: "var(--accent)" }}>
              {post.source}
            </span>{" "}
            · {post.sharer?.name}
          </div>
        </div>
      </Link>
      <button
        className={`bookmark-btn-compact${bookmarked ? " saved" : ""}`}
        onClick={() =>
          startTransition(async () => {
            setBookmarked(!bookmarked);
            await toggleBookmark(post.id);
          })
        }
        aria-label={bookmarked ? "북마크 해제" : "북마크"}
      >
        <Icon name="bookmark" filled={bookmarked} />
      </button>
    </div>
  );
}

export default function SearchClient({ posts }: { posts: FeedPost[] }) {
  const [query, setQuery] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const results = useMemo(() => {
    return posts.filter((p) => {
      const q = query.trim();
      const matchQ =
        !q ||
        p.title.includes(q) ||
        p.tags.some((t) => t.includes(q)) ||
        (p.paragraphs?.[0] || "").includes(q);
      const matchTags = tags.length === 0 || tags.every((t) => p.tags.includes(t));
      return matchQ && matchTags;
    });
  }, [posts, query, tags]);

  return (
    <div className="content">
      <div className="search-wrap">
        <div className="search-bar">
          <Icon name="search2" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="검색어를 입력하세요"
          />
          <button className="clear-btn" onClick={() => setQuery("")} aria-label="지우기">
            <Icon name="x" />
          </button>
        </div>
      </div>
      <div className="filter-label">태그 필터</div>
      <div className="chip-cloud">
        {TAGS.map((t) => (
          <button
            key={t}
            className={`chip${tags.includes(t) ? " selected" : ""}`}
            onClick={() => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))}
          >
            {t}
          </button>
        ))}
      </div>
      <div className="result-header">결과 {results.length}</div>
      <div className="compact-list">
        {results.length === 0 && <div className="empty-state">검색 결과가 없어요</div>}
        {results.map((p) => (
          <CompactCard key={p.id} post={p} query={query} />
        ))}
      </div>
    </div>
  );
}
