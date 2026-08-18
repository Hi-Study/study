import { ArticleThumbnail } from "@/components/article-thumbnail";
import { Badge } from "@/components/ui/badge";
import { BookmarkButton } from "@/components/bookmark-button";
import { MessageCircle } from "lucide-react";

export type ArticleCardData = {
  id: string;
  title: string;
  company: string;
  category: string;
  tags: string[];
  authorName: string;
  summary: string | null;
  bookmarkCount: number;
  bookmarked: boolean;
  commentCount: number;
  thumbnailUrl: string | null;
};

// 회사·카테고리·태그 배지를 전부 늘어놓으면 제목보다 배지 줄이 먼저 눈에 들어와
// 목록을 스캔하기 어려워진다. 태그는 2개까지만 보여주고 나머지는 +N으로 요약한다.
const MAX_VISIBLE_TAGS = 2;

export function ArticleCard({
  article,
  featured = false,
}: {
  article: ArticleCardData;
  featured?: boolean;
}) {
  const visibleTags = article.tags.slice(0, MAX_VISIBLE_TAGS);
  const extraTagCount = article.tags.length - visibleTags.length;

  return (
    <a
      href={`/articles/${article.id}`}
      className="flex gap-3 border-b p-4 hover:bg-muted/50"
    >
      <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
        <ArticleThumbnail thumbnailUrl={article.thumbnailUrl} company={article.company} />
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap gap-1.5">
          {featured ? <Badge variant="featured">PICK</Badge> : null}
          <Badge variant="secondary">{article.company}</Badge>
          <Badge variant="outline">{article.category}</Badge>
          {visibleTags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-muted-foreground">
              #{tag}
            </Badge>
          ))}
          {extraTagCount > 0 ? (
            <Badge variant="outline" className="text-muted-foreground">
              +{extraTagCount}
            </Badge>
          ) : null}
        </div>
        <h3 className="truncate font-medium">{article.title}</h3>
        {article.summary ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {article.summary}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">AI 요약 준비 중…</p>
        )}
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{article.authorName}</span>
          <BookmarkButton
            articleId={article.id}
            initialBookmarked={article.bookmarked}
            initialCount={article.bookmarkCount}
          />
          <span className="flex items-center gap-1">
            <MessageCircle className="h-3.5 w-3.5" /> {article.commentCount}
          </span>
        </div>
      </div>
    </a>
  );
}
