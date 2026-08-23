import { ArticleThumbnail } from "@/components/article-thumbnail";
import type { ArticleCardData } from "@/components/article-card";
import Link from "next/link";

export function ArticleMiniCard({ article }: { article: ArticleCardData }) {
  return (
    <Link
      href={`/articles/${article.id}`}
      className="flex w-40 shrink-0 flex-col gap-1.5 rounded-xl border p-2"
    >
      <div className="aspect-video w-full overflow-hidden rounded-lg bg-muted">
        <ArticleThumbnail thumbnailUrl={article.thumbnailUrl} company={article.company} />
      </div>
      <p className="line-clamp-2 text-sm font-medium">{article.title}</p>
      <p className="text-xs text-muted-foreground">{article.company}</p>
    </Link>
  );
}
