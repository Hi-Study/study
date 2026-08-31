import Icon from "@/components/Icon";
import type { Post } from "@/lib/types";

export function fmtDate(iso: string) {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

// 통일 카드 메타 라인: 기업명/출처 · 조회수 · 인사이트 수 · 날짜 (커버 카드·리스트 로우 공통)
export default function CardMeta({ post }: { post: Post }) {
  const who = post.source === "direct" ? post.author?.name ?? "직접 등록" : post.company?.name ?? "";
  return (
    <div className="cmeta">
      {who && <span className="cm-who">{who}</span>}
      <span className="cm-n"><Icon name="eye" size="sm" />{post.view_count ?? 0}</span>
      <span className="cm-n"><Icon name="review" size="sm" />{post.review_count ?? 0}</span>
      <span className="cm-date">{fmtDate(post.published_at)}</span>
    </div>
  );
}
