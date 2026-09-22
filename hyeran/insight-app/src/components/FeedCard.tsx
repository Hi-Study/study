import Link from "next/link";
import CardBookmark from "@/components/CardBookmark";
import type { Post } from "@/lib/types";

// 가로 스와이프용 카드 — 썸네일·기업 컬러·조회수 없이 글자만 [분류체계 §6-1]
// 우리가 쓴 헤드라인이 큰 줄, 원제목은 그 아래 작게. 원제목을 지우지 않는 이유는 출처 신뢰다.
export default function FeedCard({ post }: { post: Post }) {
  const who = post.source === "direct" ? post.author?.name ?? "직접 등록" : post.company?.name ?? "";
  return (
    <Link className="tcard" href={`/posts/${post.id}`}>
      <div className="tcard-top">
        {who && <span className="tcard-co">{who}</span>}
        <span className="tcard-bm"><CardBookmark postId={post.id} initial={post.bookmarked} variant="plain" /></span>
      </div>
      <h3>{post.headline || post.title}</h3>
      {post.headline && <p className="tcard-src">원문 · {post.title}</p>}
    </Link>
  );
}
