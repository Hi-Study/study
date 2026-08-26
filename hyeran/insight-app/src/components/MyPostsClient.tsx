"use client";

import { useState } from "react";
import Link from "next/link";
import Icon from "@/components/Icon";
import PostRow from "@/components/PostRow";
import DragScroll from "@/components/DragScroll";
import type { Post, CommunityPost, Word } from "@/lib/types";

type Tab = "viewed" | "insight" | "community" | "comment" | "highlight" | "word";

export default function MyPostsClient({
  viewed, insights, comments, highlights, community, words,
}: {
  viewed: Post[]; insights: Post[]; comments: Post[]; highlights: Post[];
  community: CommunityPost[]; words: Word[];
}) {
  const [tab, setTab] = useState<Tab>("viewed");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "viewed", label: "조회한 글", count: viewed.length },
    { key: "insight", label: "인사이트", count: insights.length },
    { key: "community", label: "자유글", count: community.length },
    { key: "comment", label: "댓글", count: comments.length },
    { key: "highlight", label: "하이라이트", count: highlights.length },
    { key: "word", label: "단어장", count: words.length },
  ];

  const postList = (list: Post[], empty: string) =>
    list.length ? list.map((p) => <PostRow key={p.id} post={p} />) : <div className="empty"><div className="art" /><div className="msg">{empty}</div></div>;

  return (
    <>
      <DragScroll className="seg-scroll">
        {tabs.map((t) => (
          <button key={t.key} className={`seg-chip${tab === t.key ? " on" : ""}`} onClick={() => setTab(t.key)}>
            {t.label} {t.count}
          </button>
        ))}
      </DragScroll>

      {tab === "viewed" && postList(viewed, "아직 조회한 글이 없어요")}
      {tab === "insight" && postList(insights, "아직 인사이트를 남긴 글이 없어요")}
      {tab === "comment" && postList(comments, "아직 댓글을 단 글이 없어요")}
      {tab === "highlight" && postList(highlights, "아직 하이라이트한 글이 없어요")}

      {tab === "community" && (
        community.length ? community.map((p) => (
          <Link key={p.id} href={`/community/${p.id}`} className="lrow">
            <span className="lrow-body">
              <h3>{p.title}</h3>
              <div className="cmeta">
                <span className="cm-date">{new Date(p.created_at).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })}</span>
                <span className="cm-n"><Icon name="heart" size="sm" />{p.like_count ?? 0}</span>
                <span className="cm-n"><Icon name="comment" size="sm" />{p.comment_count ?? 0}</span>
              </div>
            </span>
          </Link>
        )) : <div className="empty"><div className="art" /><div className="msg">아직 쓴 자유글이 없어요</div></div>
      )}

      {tab === "word" && (
        words.length
          ? <div className="word-list">{words.map((w) => <span key={w.id} className="wchip">{w.term}</span>)}</div>
          : <div className="empty"><div className="art" /><div className="msg">담은 단어가 없어요</div><div className="sub">원문 리더에서 문단 탭 → 단어로 담을 수 있어요</div></div>
      )}
    </>
  );
}
