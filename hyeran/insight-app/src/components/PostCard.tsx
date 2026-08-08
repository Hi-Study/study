import Link from "next/link";
import Icon from "@/components/Icon";
import { CAT_COLOR, type Post } from "@/lib/types";

export function CompanyLogo({ company, big = false }: { company?: { name: string; color: string } | null; big?: boolean }) {
  if (!company) return null;
  return (
    <span className="clogo" style={{ background: company.color }}>
      {company.name[0]}
    </span>
  );
}

// 전체 카드 (피드/검색/마이)
export default function PostCard({ post }: { post: Post }) {
  const domain = post.company?.domain ?? "";
  return (
    <Link className="card" href={`/posts/${post.id}`} style={{ ["--catc" as string]: CAT_COLOR[post.category] }}>
      <div className="hd">
        <h3>{post.title}</h3>
      </div>
      <div className="meta mono">
        {domain}
        <span className="sep" />
        {post.category}
      </div>
      {post.tags.length > 0 && (
        <div className="tagrow">
          {post.tags.map((t) => (
            <span className="tag" key={t}>{t}</span>
          ))}
        </div>
      )}
      <div className="cardacts">
        <span className="byline">{post.source === "direct" ? "직접 등록" : "자동 수집"}</span>
        <span style={{ flex: 1 }} />
        <span className="cnt"><Icon name="review" size="sm" />독후감 {post.review_count ?? 0}</span>
      </div>
    </Link>
  );
}

// 홈 스와이프용 컴팩트 카드
export function SwipeCard({ post }: { post: Post }) {
  return (
    <Link className="scard" href={`/posts/${post.id}`} style={{ ["--catc" as string]: CAT_COLOR[post.category] }}>
      <div className="hd"><h3>{post.title}</h3></div>
      <div className="meta mono">{post.company?.domain ?? ""}</div>
      <div className="cardacts"><span className="cnt"><Icon name="review" size="sm" />독후감 {post.review_count ?? 0}</span></div>
    </Link>
  );
}
