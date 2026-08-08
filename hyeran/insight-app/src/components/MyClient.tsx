"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "./Icon";
import type { FeedPost, DraftRow, Profile } from "@/lib/types";

type MyHighlight = {
  id: string;
  text: string;
  created_at: string;
  posts: { id: string; title: string; created_at: string } | { id: string; title: string; created_at: string }[];
};

function dateLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const days = Math.floor((now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86400000);
  if (days <= 0) return "오늘";
  if (days === 1) return "어제";
  if (days < 7) return "이번주";
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function MyClient({
  profile,
  myPosts,
  bookmarked,
  curated,
  highlights,
  drafts,
}: {
  profile: Profile | null;
  myPosts: FeedPost[];
  bookmarked: FeedPost[];
  curated: FeedPost[];
  highlights: MyHighlight[];
  drafts: DraftRow[];
}) {
  const [tab, setTab] = useState<"posts" | "highlights" | "bookmarks" | "curated">("posts");

  return (
    <div className="content">
      <div className="profile-block">
        <div className="avatar lg">{profile?.initial || "?"}</div>
        <div>
          <div className="profile-name">{profile?.name || "사용자"}</div>
          <div className="profile-sub">기획자 스터디</div>
        </div>
      </div>
      {drafts.length > 0 && (
        <div className="draft-section">
          <div className="draft-header">
            <Icon name="doc" />
            임시저장 {drafts.length}
          </div>
          <div className="draft-list">
            {drafts.map((d) => (
              <Link
                key={d.id}
                href={`/register/step${d.step}?draft=${d.id}`}
                className="draft-card"
              >
                <div className="draft-icon">
                  <Icon name="doc" />
                </div>
                <div className="draft-body">
                  <div className="draft-title">{d.title}</div>
                  <div className="draft-meta">
                    {d.source} · {dateLabel(d.updated_at)}
                  </div>
                </div>
                <span className="step-pill">Step {d.step}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="segment">
        <button className={tab === "posts" ? "active" : ""} onClick={() => setTab("posts")}>
          내 글
        </button>
        <button className={tab === "highlights" ? "active" : ""} onClick={() => setTab("highlights")}>
          하이라이트
        </button>
        <button className={tab === "bookmarks" ? "active" : ""} onClick={() => setTab("bookmarks")}>
          북마크
        </button>
        <button className={tab === "curated" ? "active" : ""} onClick={() => setTab("curated")}>
          큐레이션
        </button>
      </div>

      {tab === "posts" && (
        <div className="compact-list">
          {myPosts.length === 0 ? (
            <div className="empty-state">
              아직 올린 글이 없어요.
              <br />
              홈 화면의 + 버튼으로 첫 글을 등록해보세요.
            </div>
          ) : (
            myPosts.map((p) => <CompactRow key={p.id} post={p} />)
          )}
        </div>
      )}
      {tab === "bookmarks" && (
        <div className="compact-list">
          {bookmarked.length === 0 ? (
            <div className="empty-state">
              북마크한 글이 없어요.
              <br />
              상세 화면 상단의 책갈피 아이콘으로 저장해보세요.
            </div>
          ) : (
            bookmarked.map((p) => <CompactRow key={p.id} post={p} />)
          )}
        </div>
      )}
      {tab === "curated" && (
        <div className="compact-list">
          {curated.length === 0 ? (
            <div className="empty-state">아직 얘기하고 싶어요를 누른 글이 없어요.</div>
          ) : (
            curated.map((p) => <CompactRow key={p.id} post={p} />)
          )}
        </div>
      )}
      {tab === "highlights" && (
        <div>
          {highlights.length === 0 ? (
            <div className="empty-state">
              아직 남긴 하이라이트가 없어요.
              <br />
              글을 등록하면서 원문에 하이라이트를 남겨보세요.
            </div>
          ) : (
            highlights.map((h) => {
              const post = Array.isArray(h.posts) ? h.posts[0] : h.posts;
              return (
                <Link key={h.id} href={`/post/${post.id}`} className="hl-quote-card">
                  <div className="hl-quote-text">&quot;{h.text}&quot;</div>
                  <div className="hl-quote-meta">
                    {post.title}에서 · {dateLabel(h.created_at)}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function CompactRow({ post }: { post: FeedPost }) {
  return (
    <Link href={`/post/${post.id}`} className="compact-card">
      <div className="compact-card-main">
        <div className="compact-thumb">
          <Icon name={(post.icon as never) || "link"} />
        </div>
        <div className="compact-body">
          <div className="compact-title">{post.title}</div>
          <div className="compact-meta">
            <span className="src" style={{ color: "var(--accent)" }}>
              {post.source}
            </span>{" "}
            · {post.sharer?.name}
          </div>
        </div>
      </div>
    </Link>
  );
}
