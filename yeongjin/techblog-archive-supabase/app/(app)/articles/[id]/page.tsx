import { AddNoteForm } from "@/components/add-note-form";
import { AiSummaryCard } from "@/components/ai-summary-card";
import { ArticleThumbnail } from "@/components/article-thumbnail";
import { BackButton } from "@/components/back-button";
import { BookmarkButton } from "@/components/bookmark-button";
import { CommentSection } from "@/components/comment-section";
import { CompanyFollowButton } from "@/components/company-follow-button";
import { EmptyState } from "@/components/empty-state";
import { ExtractBodyButton } from "@/components/extract-body-button";
import { HighlightCard } from "@/components/highlight-card";
import { HighlightDistribution } from "@/components/highlight-distribution";
import { HighlightExplainer } from "@/components/highlight-explainer";
import { UnderlineTabs } from "@/components/underline-tabs";
import { Badge } from "@/components/ui/badge";
import { getArticleById } from "@/lib/db/articles";
import { PREVIEW_USER_KEY, countBookmarksByArticle, listBookmarksByUser } from "@/lib/db/bookmarks";
import { listCommentsByArticle } from "@/lib/db/comments";
import { listFollowedCompanies } from "@/lib/db/company-follows";
import { listHighlightsByArticleAndUser } from "@/lib/db/highlights";
import { markArticleRead } from "@/lib/db/reads";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

export const dynamic = "force-dynamic";

function formatDate(iso: string) {
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export default async function ArticleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; sub?: string }>;
}) {
  const { id } = await params;
  const { tab, sub } = await searchParams;
  const activeTab = tab === "highlights" ? "highlights" : "info";
  const activeSub = sub === "highlights" ? "highlights" : "comments";

  const article = await getArticleById(id);
  if (!article) notFound();

  let userKey = PREVIEW_USER_KEY;
  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) userKey = user.id;
  }

  const [comments, bookmarkCounts, myBookmarks, myHighlights, myFollowedCompanies] =
    await Promise.all([
      listCommentsByArticle(id),
      countBookmarksByArticle(),
      listBookmarksByUser(userKey),
      listHighlightsByArticleAndUser(id, userKey),
      listFollowedCompanies(userKey),
      markArticleRead(id, userKey),
    ]);

  const hasNote = Boolean(article.impressive_part && article.apply_idea && article.discussion_question);

  return (
    <div>
      <header className="sticky top-0 z-40 flex items-center gap-2 border-b bg-background p-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <BackButton />
        <span className="truncate text-sm font-medium text-muted-foreground">{article.title}</span>
      </header>

      {/* 히어로 영역 */}
      <div className="p-4">
        <div className="aspect-video w-full overflow-hidden rounded-2xl">
          <ArticleThumbnail thumbnailUrl={article.thumbnail_url} company={article.company} />
        </div>

        <h1 className="mt-4 text-xl font-bold">{article.title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {article.company} · {formatDate(article.created_at)}
        </p>

        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <span>댓글 {comments.length}</span>
          <span>·</span>
          <span>하이라이트 {myHighlights.length}</span>
          <span>·</span>
          <span>북마크 {bookmarkCounts[article.id] ?? 0}</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <BookmarkButton
            articleId={article.id}
            initialBookmarked={myBookmarks.some((b) => b.article_id === article.id)}
            initialCount={bookmarkCounts[article.id] ?? 0}
            variant="pill"
          />
          <CompanyFollowButton
            company={article.company}
            initialFollowing={myFollowedCompanies.includes(article.company)}
          />
          <a
            href={article.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center rounded-full border px-2 py-1 text-xs text-muted-foreground"
          >
            원문 보러가기
          </a>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge variant="outline">{article.category}</Badge>
          {article.source_type === "auto" ? <Badge variant="outline">자동 수집</Badge> : null}
          {article.tags.map((tag) => (
            <Badge key={tag} variant="outline" className="text-muted-foreground">
              #{tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* 메인 탭: 원문 정보 / 하이라이트·댓글 */}
      <div className="border-b px-4">
        <UnderlineTabs
          items={[
            { key: "info", label: "원문 정보", href: `/articles/${id}?tab=info`, active: activeTab === "info" },
            {
              key: "highlights",
              label: "하이라이트 · 댓글",
              href: `/articles/${id}?tab=highlights`,
              active: activeTab === "highlights",
            },
          ]}
        />
      </div>

      {activeTab === "info" ? (
        <div className="p-4">
          <HighlightExplainer articleId={article.id}>
            <div data-zone="ai_summary">
              <AiSummaryCard
                articleId={article.id}
                status={article.ai_status}
                problem={article.ai_problem}
                solution={article.ai_solution}
                takeaway={article.ai_takeaway}
              />
            </div>

            {hasNote ? (
              <div data-zone="note" className="mt-4 rounded-2xl border p-4">
                <p className="mb-2 text-sm font-semibold">독후감</p>
                <div className="flex flex-col gap-3 text-sm">
                  <div>
                    <p className="font-medium">인상 깊은 부분</p>
                    <p className="text-muted-foreground">{article.impressive_part}</p>
                  </div>
                  <div>
                    <p className="font-medium">접목하고 싶은 방법</p>
                    <p className="text-muted-foreground">{article.apply_idea}</p>
                  </div>
                  <div>
                    <p className="font-medium">질문 / 토론하고 싶은 것</p>
                    <p className="text-muted-foreground">{article.discussion_question}</p>
                  </div>
                </div>
              </div>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              💡 아래 텍스트를 드래그하면 형광펜·메모·AI 쉬운 설명을 쓸 수 있어요.
            </p>

            {article.body_html ? (
              <div data-zone="body" className="mt-4 rounded-2xl border p-4">
                <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    원저작: {article.body_byline ?? article.company}
                    {" · "}
                    <a href={article.url} target="_blank" rel="noreferrer" className="underline">
                      원문 바로 읽기
                    </a>
                  </span>
                </div>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none prose-a:text-primary"
                  dangerouslySetInnerHTML={{ __html: article.body_html }}
                />
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border p-4 text-sm text-muted-foreground">
                <p>아직 본문을 불러오지 못했어요. 원문 링크로 확인하거나 다시 시도해보세요.</p>
                <ExtractBodyButton articleId={article.id} />
              </div>
            )}
          </HighlightExplainer>

          {!hasNote ? <AddNoteForm articleId={article.id} /> : null}
        </div>
      ) : (
        <div>
          <div className="border-b px-4 pt-3">
            <UnderlineTabs
              items={[
                {
                  key: "comments",
                  label: `댓글 ${comments.length}`,
                  href: `/articles/${id}?tab=highlights&sub=comments`,
                  active: activeSub === "comments",
                },
                {
                  key: "highlights",
                  label: `하이라이트 ${myHighlights.length}`,
                  href: `/articles/${id}?tab=highlights&sub=highlights`,
                  active: activeSub === "highlights",
                },
              ]}
            />
          </div>

          {activeSub === "comments" ? (
            <CommentSection
              articleId={article.id}
              initialComments={comments}
              askAuthorName={!AUTH_REQUIRED}
            />
          ) : myHighlights.length === 0 ? (
            <EmptyState message="아직 형광펜으로 표시한 부분이 없어요. 원문 정보 탭에서 텍스트를 드래그해보세요." />
          ) : (
            <div>
              <div className="p-4">
                <p className="mb-3 text-sm font-semibold">어디에 많이 표시했나요</p>
                <HighlightDistribution highlights={myHighlights} />
              </div>
              <div>
                {myHighlights.map((h) => (
                  <HighlightCard key={h.id} highlight={h} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
