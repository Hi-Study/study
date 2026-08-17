import Link from "next/link";
import { CompanyLogo } from "@/components/PostCard";
import CardBookmark from "@/components/CardBookmark";
import CardMeta from "@/components/CardMeta";
import { coverImage, readableText, type Post } from "@/lib/types";

// 이미지 중심 커버 카드 (기준 화면 · 통일 카드 메타)
export default function FeedCard({ post }: { post: Post }) {
  const cover = coverImage(post);
  const cc = post.company?.color ?? "#161616";
  const coName = post.company?.name ?? (post.source === "direct" ? "직접 등록" : "");
  const onBrand = readableText(cc);

  return (
    <Link className="fcard" href={`/posts/${post.id}`}>
      <div
        className={`fcard-cover${cover ? "" : " ph"}`}
        style={{ ["--cc" as string]: cc, ...(cover ? { backgroundImage: `url("${cover}")` } : {}) }}
      >
        {!cover && (
          <span className="fcard-ph-logo">
            <CompanyLogo company={post.company} />
          </span>
        )}
        {post.read && <span className="fcard-read">읽음</span>}
        <span className="fcard-bm-wrap"><CardBookmark postId={post.id} initial={post.bookmarked} /></span>
        {coName && (
          <span className="fcard-co" style={{ background: cc, color: onBrand }}>{coName}</span>
        )}
      </div>
      <div className="fcard-body">
        <h3>{post.title}</h3>
        <CardMeta post={post} />
      </div>
    </Link>
  );
}
