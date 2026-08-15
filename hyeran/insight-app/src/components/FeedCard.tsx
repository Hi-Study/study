import Link from "next/link";
import Icon from "@/components/Icon";
import { CompanyLogo } from "@/components/PostCard";
import { coverImage, readableText, type Post } from "@/lib/types";

function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

// 이미지 중심 피드 카드 (기준 화면)
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
        <span className="fcard-date">{fmtDate(post.published_at)}</span>
        {coName && (
          <span className="fcard-co" style={{ background: cc, color: onBrand }}>{coName}</span>
        )}
      </div>
      <div className="fcard-body">
        <h3>{post.title}</h3>
        <div className="fcard-meta">
          <span className="fcard-views"><Icon name="review" size="sm" />인사이트 {post.review_count ?? 0}</span>
        </div>
      </div>
    </Link>
  );
}
