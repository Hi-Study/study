import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getPostDetail } from "@/lib/queries";
import { CATEGORY_LABELS, formatRelativeDate } from "@/lib/labels";
import { ReadTracker } from "@/components/ReadTracker";
import { BookmarkButton } from "@/components/BookmarkButton";
import { MarkReadButton } from "@/components/MarkReadButton";
import { DeletePostButton } from "@/components/DeletePostButton";
import { RegistrantNotes } from "@/components/RegistrantNotes";
import { SummaryBox } from "@/components/SummaryBox";
import { CommentSection } from "@/components/CommentSection";
import { DiscussionSection } from "@/components/DiscussionSection";
import { MemoSection } from "@/components/MemoSection";

export default async function PostDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab = "comment" } = await searchParams;
  const session = await auth();
  const userId = session!.user.id;

  const detail = await getPostDetail(id, userId);
  if (!detail) notFound();

  const { post, bookmarked, readStatus } = detail;
  const canDelete = post.sourceType === "MEMBER_REGISTERED" && post.registeredById === userId;

  return (
    <div className="flex flex-col gap-5">
      <ReadTracker postId={post.id} alreadyDone={readStatus === "DONE"} />

      <div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">{post.company?.name ?? "기타"}</span>
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 dark:bg-neutral-800">{CATEGORY_LABELS[post.category]}</span>
          {post.sourceType === "AUTO_COLLECTED" ? (
            <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-700 dark:bg-sky-950 dark:text-sky-300">자동 수집</span>
          ) : (
            <span>{post.registeredBy?.name} 등록</span>
          )}
          <span>{formatRelativeDate(post.publishedAt)}</span>
        </div>

        <h1 className="mt-2 text-xl font-bold text-neutral-900 dark:text-neutral-100">{post.title}</h1>
        {post.authorName ? <p className="mt-1 text-sm text-neutral-400">글쓴이: {post.authorName}</p> : null}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <a
            href={post.originalUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-strong"
          >
            원문 바로 읽기 ↗
          </a>
          <BookmarkButton postId={post.id} initialBookmarked={bookmarked} />
          <MarkReadButton postId={post.id} status={readStatus} />
          {canDelete ? <DeletePostButton postId={post.id} /> : null}
        </div>
      </div>

      <RegistrantNotes postId={post.id} notes={post.registrantNotes} />
      <SummaryBox postId={post.id} summary={post.summary} />

      <article
        className="prose prose-neutral dark:prose-invert max-w-none prose-img:rounded-lg prose-a:text-primary"
        dangerouslySetInnerHTML={{ __html: post.contentHtml }}
      />

      <MemoSection postId={post.id} memos={post.memos} currentUserId={userId} />

      <div>
        <div className="flex gap-1 border-b border-neutral-200 dark:border-neutral-800">
          <Link
            href={`/posts/${post.id}?tab=comment`}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === "comment" ? "border-primary text-primary" : "border-transparent text-neutral-400"
            }`}
          >
            댓글 {post.comments.length}
          </Link>
          <Link
            href={`/posts/${post.id}?tab=discussion`}
            className={`border-b-2 px-3 py-2 text-sm font-medium ${
              tab === "discussion" ? "border-primary text-primary" : "border-transparent text-neutral-400"
            }`}
          >
            토론 {post.discussions.length}
          </Link>
        </div>

        <div className="mt-4">
          {tab === "discussion" ? (
            <DiscussionSection postId={post.id} discussions={post.discussions} />
          ) : (
            <CommentSection postId={post.id} comments={post.comments} currentUserId={userId} />
          )}
        </div>
      </div>
    </div>
  );
}
