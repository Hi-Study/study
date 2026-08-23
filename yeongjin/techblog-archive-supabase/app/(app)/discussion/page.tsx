import { ArticleThumbnail } from "@/components/article-thumbnail";
import { EmptyState } from "@/components/empty-state";
import { FilterChipRow } from "@/components/filter-chip-row";
import { NotificationBell } from "@/components/notification-bell";
import { ParticipateButton } from "@/components/participate-button";
import { UnderlineTabs } from "@/components/underline-tabs";
import { Badge } from "@/components/ui/badge";
import { listArticles } from "@/lib/db/articles";
import { PREVIEW_USER_KEY, countBookmarksByArticle } from "@/lib/db/bookmarks";
import { countCommentsByArticle } from "@/lib/db/comments";
import {
  countParticipantsByArticle,
  listParticipatingArticleIds,
} from "@/lib/db/discussion-participants";
import { createClient } from "@/lib/supabase/server";
import { MessageCircle, Users } from "lucide-react";
import Link from "next/link";

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

const SORTS = [
  { key: "popular", label: "인기" },
  { key: "latest", label: "최신" },
  { key: "recommended", label: "추천" },
] as const;

export const dynamic = "force-dynamic";

export default async function DiscussionPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; category?: string }>;
}) {
  const { sort, category } = await searchParams;
  const activeSort = SORTS.some((s) => s.key === sort) ? sort! : "popular";
  const activeCategory = category ?? "전체";

  let userKey = PREVIEW_USER_KEY;
  if (AUTH_REQUIRED) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) userKey = user.id;
  }

  const [all, commentCounts, participantCounts, bookmarkCounts, myParticipating] = await Promise.all([
    listArticles(),
    countCommentsByArticle(),
    countParticipantsByArticle(),
    countBookmarksByArticle(),
    listParticipatingArticleIds(userKey),
  ]);

  // 독후감(질문·토론하고 싶은 것)이 곧 토론의 단위 — 읽은 글을 바탕으로 다른 사람과 견해를
  // 나누는 게 핵심 가치라, 아직 독후감이 없는 자동 수집 글은 목록에서 제외한다.
  const withNote = all.filter((a) => a.discussion_question);
  const categories = [...new Set(withNote.map((a) => a.category))].sort();
  const filtered =
    activeCategory === "전체" ? withNote : withNote.filter((a) => a.category === activeCategory);

  const items = [...filtered].sort((a, b) => {
    if (activeSort === "latest") return b.created_at.localeCompare(a.created_at);
    if (activeSort === "recommended") {
      const diff = (bookmarkCounts[b.id] ?? 0) - (bookmarkCounts[a.id] ?? 0);
      return diff !== 0 ? diff : b.created_at.localeCompare(a.created_at);
    }
    // 인기: 참여 인원 + 댓글 수를 함께 반영
    const engagementA = (participantCounts[a.id] ?? 0) + (commentCounts[a.id] ?? 0);
    const engagementB = (participantCounts[b.id] ?? 0) + (commentCounts[b.id] ?? 0);
    const diff = engagementB - engagementA;
    return diff !== 0 ? diff : b.created_at.localeCompare(a.created_at);
  });

  return (
    <div>
      <header className="sticky top-0 z-40 border-b bg-background pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="flex items-center justify-between px-4">
          <h1 className="text-lg font-semibold">토론</h1>
          <NotificationBell />
        </div>
        <p className="px-4 pt-1 text-sm text-muted-foreground">
          읽은 글을 바탕으로 다른 사람과 토론하며 내 생각을 넓혀보세요.
        </p>

        <div className="mt-2 px-4">
          <UnderlineTabs
            items={SORTS.map((s) => ({
              key: s.key,
              label: s.label,
              href: `/discussion?sort=${s.key}${activeCategory !== "전체" ? `&category=${encodeURIComponent(activeCategory)}` : ""}`,
              active: activeSort === s.key,
            }))}
          />
        </div>

        {categories.length > 0 ? (
          <div className="px-4 py-2">
            <FilterChipRow
              items={["전체", ...categories].map((c) => ({
                key: c,
                label: c,
                href: `/discussion?sort=${activeSort}${c !== "전체" ? `&category=${encodeURIComponent(c)}` : ""}`,
                selected: c === activeCategory,
              }))}
            />
          </div>
        ) : null}
      </header>

      <div>
        {items.length === 0 ? (
          <EmptyState message="아직 등록된 독후감이 없어요." />
        ) : (
          items.map((a) => (
            <div key={a.id} className="flex gap-3 border-b p-4">
              <Link href={`/articles/${a.id}`} className="flex flex-1 gap-3 hover:opacity-90">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                  <ArticleThumbnail thumbnailUrl={a.thumbnail_url} company={a.company} />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge variant="secondary">{a.company}</Badge>
                    <span className="text-xs text-muted-foreground">{a.category}</span>
                  </div>
                  <p className="mt-1 truncate text-xs text-muted-foreground">이 글 기반 · {a.title}</p>
                  <p className="mt-0.5 line-clamp-2 font-medium">{a.discussion_question}</p>
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" /> {participantCounts[a.id] ?? 0}명 참여 중
                    </span>
                    <span className="flex items-center gap-1">
                      <MessageCircle className="h-3.5 w-3.5" /> {commentCounts[a.id] ?? 0}
                    </span>
                  </div>
                </div>
              </Link>
              <div className="flex shrink-0 items-end">
                <ParticipateButton articleId={a.id} initialJoined={myParticipating.has(a.id)} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
