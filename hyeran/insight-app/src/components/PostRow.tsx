import Link from "next/link";
import { CompanyLogo } from "@/components/PostCard";
import CardBookmark from "@/components/CardBookmark";
import CardMeta from "@/components/CardMeta";
import { coverImage, type Post } from "@/lib/types";

// 리스트 로우 (lrow) — 검색·마이. 썸네일 + 제목 + 통일 메타 + 북마크 (지난 노트 스타일)
export default function PostRow({ post }: { post: Post }) {
  const cover = coverImage(post);
  const cc = post.company?.color ?? "#161616";
  return (
    <Link className="lrow" href={`/posts/${post.id}`}>
      <span
        className={`lrow-thumb${cover ? "" : " ph"}`}
        style={{ ["--cc" as string]: cc, ...(cover ? { backgroundImage: `url("${cover}")` } : {}) }}
      >
        {!cover && <span className="lrow-ph-logo"><CompanyLogo company={post.company} /></span>}
      </span>
      <span className="lrow-body">
        <h3>{post.title}</h3>
        <CardMeta post={post} />
      </span>
      <span className="lrow-bm"><CardBookmark postId={post.id} initial={post.bookmarked} variant="plain" /></span>
    </Link>
  );
}
