import { ArticleCard } from "@/components/article-card";
import { EmptyState } from "@/components/empty-state";
import { NotificationBell } from "@/components/notification-bell";
import { RecentSearches } from "@/components/recent-searches";
import { Badge } from "@/components/ui/badge";
import { listArticles, searchArticles } from "@/lib/db/articles";
import { PREVIEW_USER_KEY, countBookmarksByArticle, listBookmarksByUser } from "@/lib/db/bookmarks";
import { countCommentsByArticle } from "@/lib/db/comments";
import { logSearch, topSearchQueries } from "@/lib/db/search-logs";
import { createClient } from "@/lib/supabase/server";
import { toArticleCardData } from "@/lib/article-view";
import Link from "next/link";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

// 추천 검색어(PRD v0.2 4.7) — 큐레이션/개인화 엔진 이전 단계라 질문형 문구를 고정 큐레이션으로 둔다.
const SUGGESTED_QUERIES = [
  "A/B 테스트, 어떻게 설계하지?",
  "장애 대응은 어떻게 하고 있을까?",
  "온보딩 경험은 어떻게 설계할까?",
  "AI를 실무에 어떻게 접목했을까?",
  "MSA 전환, 우리 팀도 필요할까?",
];

export const dynamic = "force-dynamic";

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tag?: string }>;
}) {
  const { q, tag } = await searchParams;
  const hasQuery = Boolean(q || tag);

  const all = await listArticles();
  const tagCounts = new Map<string, number>();
  for (const a of all) {
    for (const t of a.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const popularTags = [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);

  const results = hasQuery ? await searchArticles({ q, tag }) : [];
  if (q) await logSearch(q);
  const trending = await topSearchQueries(6);

  let userKey = PREVIEW_USER_KEY;
  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) userKey = user.id;
  }

  const [bookmarkCounts, commentCounts, myBookmarks] = await Promise.all([
    countBookmarksByArticle(),
    countCommentsByArticle(),
    listBookmarksByUser(userKey),
  ]);
  const bookmarkedIds = new Set(myBookmarks.map((b) => b.article_id));

  const articles = results.map((a) =>
    toArticleCardData(a, { bookmarkCounts, commentCounts, bookmarkedIds }),
  );

  return (
    <div className="p-4 pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">검색</h1>
        <NotificationBell />
      </div>
      <form action="/search" className="flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="제목, 회사, 태그로 검색"
          className="flex h-10 w-full rounded-full border bg-background px-4 py-1 text-sm"
        />
      </form>

      {!hasQuery ? (
        <div className="mt-6 flex flex-col gap-6">
          <RecentSearches />

          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">추천 검색어</h2>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUERIES.map((sq) => (
                <Link key={sq} href={`/search?q=${encodeURIComponent(sq)}`}>
                  <Badge variant="outline">{sq}</Badge>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">급상승 검색어</h2>
            {trending.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 쌓인 검색 기록이 없어요.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {trending.map((t, i) => (
                  <Link
                    key={t.query}
                    href={`/search?q=${encodeURIComponent(t.query)}`}
                    className="flex items-center gap-2 text-sm hover:underline"
                  >
                    <span className="w-4 text-muted-foreground">{i + 1}</span>
                    <span>{t.query}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div>
            <h2 className="mb-2 text-sm font-medium text-muted-foreground">인기 태그</h2>
            {popularTags.length === 0 ? (
              <p className="text-sm text-muted-foreground">아직 태그가 달린 글이 없어요.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {popularTags.map((t) => (
                  <Link key={t} href={`/search?tag=${encodeURIComponent(t)}`}>
                    <Badge variant="secondary">#{t}</Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-4">
          <RecentSearches currentQuery={q} visible={false} />
          {articles.length === 0 ? (
            <EmptyState message="검색 결과가 없어요." />
          ) : (
            <div className="-mx-4">
              {articles.map((article) => (
                <ArticleCard key={article.id} article={article} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
