import type { ArticleCardData } from "@/components/article-card";
import type { ArticleRecord } from "@/lib/db/articles";

export function toArticleCardData(
  a: ArticleRecord,
  ctx: {
    bookmarkCounts: Record<string, number>;
    commentCounts: Record<string, number>;
    bookmarkedIds: Set<string>;
  },
): ArticleCardData {
  return {
    id: a.id,
    title: a.title,
    company: a.company,
    category: a.category,
    tags: a.tags,
    authorName: a.source_type === "auto" ? "자동 수집" : a.created_by ? "팀원" : "미리보기",
    summary: a.ai_problem,
    bookmarkCount: ctx.bookmarkCounts[a.id] ?? 0,
    bookmarked: ctx.bookmarkedIds.has(a.id),
    commentCount: ctx.commentCounts[a.id] ?? 0,
    thumbnailUrl: a.thumbnail_url,
  };
}
