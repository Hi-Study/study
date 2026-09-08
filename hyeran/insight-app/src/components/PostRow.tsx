import Link from "next/link";
import CardBookmark from "@/components/CardBookmark";
import { fmtDate } from "@/components/CardMeta";
import type { Post } from "@/lib/types";

// 세로 목록 로우 — 썸네일·기업 컬러·조회수 없이 글자만 [분류체계 §6-1]
export default function PostRow({ post }: { post: Post }) {
  const who = post.source === "direct" ? post.author?.name ?? "직접 등록" : post.company?.name ?? "";
  return (
    <Link className="trow" href={`/posts/${post.id}`}>
      <span className="trow-body">
        <h3>{post.headline || post.title}</h3>
        {post.headline && <span className="trow-src">원문 · {post.title}</span>}
        <span className="trow-meta">
          {who}
          {who && " · "}
          {fmtDate(post.published_at)}
          {post.read && <span className="trow-read">읽음</span>}
        </span>
      </span>
      <span className="trow-bm"><CardBookmark postId={post.id} initial={post.bookmarked} variant="plain" /></span>
    </Link>
  );
}
