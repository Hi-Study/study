import { ArticleCard } from "@/components/article-card";
import { DraftItem } from "@/components/draft-item";
import { EmptyState } from "@/components/empty-state";
import { LogoutButton } from "@/components/logout-button";
import { NotificationBell } from "@/components/notification-bell";
import { ReadingCalendar } from "@/components/reading-calendar";
import { UnderlineTabs } from "@/components/underline-tabs";
import { listArticles } from "@/lib/db/articles";
import { PREVIEW_USER_KEY, countBookmarksByArticle, listBookmarksByUser } from "@/lib/db/bookmarks";
import { countCommentsByArticle, listCommentsByUser } from "@/lib/db/comments";
import { listDraftsByUser } from "@/lib/db/drafts";
import { listHighlightsByUser } from "@/lib/db/highlights";
import { listReadsByUser } from "@/lib/db/reads";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { toArticleCardData } from "@/lib/article-view";

// TODO: 로그인 없이 화면을 미리 보는 동안(AUTH_REQUIRED=false)에는 예시 프로필로 대체한다.
const MOCK_PROFILE = { display_name: "미리보기 사용자", email: "preview@example.com" };
const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

const SECTIONS = [
  { key: "drafts", label: "임시저장" },
  { key: "articles", label: "내 글" },
  { key: "comments", label: "내 댓글" },
  { key: "bookmarks", label: "북마크" },
  { key: "highlights", label: "하이라이트·메모" },
  { key: "reads", label: "읽은 아티클" },
] as const;

export const dynamic = "force-dynamic";

export default async function MyPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const activeSection = SECTIONS.some((s) => s.key === section) ? section! : "articles";

  // AUTH_REQUIRED=false 일 때는 Supabase 호출을 건너뛴다(지금처럼 프로젝트가 죽어
  // 있어도 화면 테스트가 막히지 않게).
  let displayName: string = MOCK_PROFILE.display_name;
  let isLoggedIn = false;
  let userKey = PREVIEW_USER_KEY;

  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      isLoggedIn = true;
      userKey = user.id;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name")
        .eq("id", user.id)
        .single();
      displayName = profile?.display_name ?? user.email ?? MOCK_PROFILE.display_name;
    }
  }

  const [
    allArticles,
    myBookmarks,
    bookmarkCounts,
    commentCounts,
    myReads,
    myComments,
    myDrafts,
    myHighlights,
  ] = await Promise.all([
    listArticles(),
    listBookmarksByUser(userKey),
    countBookmarksByArticle(),
    countCommentsByArticle(),
    listReadsByUser(userKey),
    listCommentsByUser(userKey),
    listDraftsByUser(userKey),
    listHighlightsByUser(userKey),
  ]);

  // 내 글 = 내가 직접 등록한 글 + 내가 독후감을 채운 크롤링 글(PRD v0.2 4.8 "등록한 글 + 크롤링한 글").
  const myArticles = allArticles.filter((a) =>
    a.source_type === "manual"
      ? a.created_by === (isLoggedIn ? userKey : null)
      : a.note_author === userKey,
  );
  const bookmarkedIds = new Set(myBookmarks.map((b) => b.article_id));
  const bookmarkedArticles = allArticles.filter((a) => bookmarkedIds.has(a.id));
  const articleById = new Map(allArticles.map((a) => [a.id, a]));
  const readArticles = myReads
    .map((r) => articleById.get(r.article_id))
    .filter((a): a is NonNullable<typeof a> => a !== undefined);

  const toCardData = (a: (typeof allArticles)[number]) =>
    toArticleCardData(a, { bookmarkCounts, commentCounts, bookmarkedIds });

  const now = new Date();
  const activeDates = new Set(myReads.map((r) => r.read_at.slice(0, 10)));
  const thisMonthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const readThisMonth = myReads.filter((r) => r.read_at.startsWith(thisMonthPrefix)).length;

  return (
    <div>
      {/* 커버 + 프로필 */}
      <div className="h-24 bg-gradient-to-br from-primary/70 to-accent" />
      <div className="px-4">
        <div className="-mt-8 flex items-end justify-between">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-background bg-primary text-xl font-bold text-primary-foreground">
            {displayName.slice(0, 1)}
          </div>
          <div className="pb-1">
            <NotificationBell />
          </div>
        </div>
        <p className="mt-2 text-lg font-bold">{displayName}</p>
        <div className="mt-1 flex gap-3 text-sm text-muted-foreground">
          <span>
            내 글 <span className="font-semibold text-foreground">{myArticles.length}</span>
          </span>
          <span>
            댓글 <span className="font-semibold text-foreground">{myComments.length}</span>
          </span>
          <span>
            북마크 <span className="font-semibold text-foreground">{bookmarkedArticles.length}</span>
          </span>
        </div>
      </div>

      {/* 활동 카드 2종 */}
      <div className="mt-4 grid grid-cols-2 gap-3 px-4">
        <div className="rounded-2xl border p-4">
          <p className="text-sm font-semibold text-muted-foreground">이번 달 읽은 글</p>
          <p className="mt-3 text-3xl font-bold">{readThisMonth}개</p>
          <p className="mt-1 text-xs text-muted-foreground">전체 {myReads.length}개</p>
        </div>
        <div className="rounded-2xl border p-4">
          <ReadingCalendar activeDates={activeDates} />
        </div>
      </div>

      {/* 섹션 탭 */}
      <div className="mt-6 border-b px-4">
        <UnderlineTabs
          items={SECTIONS.map((s) => ({
            key: s.key,
            label: s.label,
            href: `/my?section=${s.key}`,
            active: activeSection === s.key,
          }))}
        />
      </div>

      <div className="pb-6">
        {activeSection === "drafts" ? (
          myDrafts.length === 0 ? (
            <EmptyState message="임시저장한 글이 없어요." />
          ) : (
            <div className="flex flex-col gap-2 p-4">
              {myDrafts.map((d) => (
                <DraftItem key={d.id} draft={d} />
              ))}
            </div>
          )
        ) : null}

        {activeSection === "articles" ? (
          myArticles.length === 0 ? (
            <EmptyState
              message="아직 올린 글이 없어요."
              actionLabel="첫 글 등록하기"
              actionHref="/articles/new"
            />
          ) : (
            <div>
              {myArticles.map((a) => (
                <ArticleCard key={a.id} article={toCardData(a)} />
              ))}
            </div>
          )
        ) : null}

        {activeSection === "comments" ? (
          myComments.length === 0 ? (
            <EmptyState message="아직 남긴 댓글이 없어요." />
          ) : (
            <div className="flex flex-col gap-3 p-4">
              {myComments.map((c) => {
                const article = articleById.get(c.article_id);
                return (
                  <Link
                    key={c.id}
                    href={`/articles/${c.article_id}`}
                    className="rounded-2xl border p-3 hover:bg-muted/50"
                  >
                    <p className="truncate text-xs text-muted-foreground">
                      {article?.title ?? "삭제된 글"}
                    </p>
                    <p className="mt-1 text-sm">{c.body}</p>
                  </Link>
                );
              })}
            </div>
          )
        ) : null}

        {activeSection === "bookmarks" ? (
          bookmarkedArticles.length === 0 ? (
            <EmptyState message="아직 북마크한 글이 없어요." />
          ) : (
            <div>
              {bookmarkedArticles.map((a) => (
                <ArticleCard key={a.id} article={toCardData(a)} />
              ))}
            </div>
          )
        ) : null}

        {activeSection === "highlights" ? (
          myHighlights.length === 0 ? (
            <EmptyState message="아직 형광펜으로 표시한 부분이 없어요." />
          ) : (
            <div className="flex flex-col gap-3 p-4">
              {myHighlights.map((h) => {
                const article = articleById.get(h.article_id);
                return (
                  <Link
                    key={h.id}
                    href={`/articles/${h.article_id}`}
                    className="rounded-2xl border-l-2 border-highlight bg-highlight/5 p-3 hover:bg-highlight/10"
                  >
                    <p className="truncate text-xs text-muted-foreground">
                      {article?.title ?? "삭제된 글"}
                    </p>
                    <p className="mt-1 text-sm italic text-muted-foreground">&quot;{h.quote}&quot;</p>
                    {h.note ? <p className="mt-1 text-sm">{h.note}</p> : null}
                  </Link>
                );
              })}
            </div>
          )
        ) : null}

        {activeSection === "reads" ? (
          readArticles.length === 0 ? (
            <EmptyState message="아직 읽은 글이 없어요." />
          ) : (
            <div>
              {readArticles.map((a) => (
                <ArticleCard key={a.id} article={toCardData(a)} />
              ))}
            </div>
          )
        ) : null}
      </div>

      {isLoggedIn ? (
        <div className="px-4 pb-6">
          <LogoutButton />
        </div>
      ) : null}
    </div>
  );
}
