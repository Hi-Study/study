import Link from "next/link";
import type { PostCard as PostCardData } from "@/lib/queries";
import { CATEGORY_LABELS, READ_STATUS_LABELS, formatRelativeDate } from "@/lib/labels";
import { BrandMarkPlaceholder } from "@/components/BrandLogo";

// 5.0 아티클 카드 공통 규격
export function PostCard({ post }: { post: PostCardData }) {
  return (
    <div className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-neutral-800 dark:bg-neutral-900">
      <Link href={`/posts/${post.id}`} className="block">
        <div className="relative aspect-[16/9] w-full bg-neutral-100 dark:bg-neutral-800">
          {post.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={post.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <BrandMarkPlaceholder />
          )}

          <div className="absolute left-2 top-2 flex gap-1">
            <span className="rounded-full bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
              {post.companyName ?? "기타"}
            </span>
            {post.sourceType === "AUTO_COLLECTED" ? (
              <span className="rounded-full bg-sky-600/90 px-2 py-0.5 text-xs font-medium text-white">자동 수집</span>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="relative -mt-9 flex justify-end px-2">
        <a
          href={post.originalUrl}
          target="_blank"
          rel="noreferrer"
          className="rounded-full bg-white/95 px-3 py-1 text-xs font-semibold text-primary shadow hover:bg-white dark:bg-neutral-900/95"
        >
          원문 바로 읽기 ↗
        </a>
      </div>

      <Link href={`/posts/${post.id}`} className="block p-4 pt-2">
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {post.companyName ?? "기타"} · {formatRelativeDate(post.publishedAt)}
        </p>
        <h3 className="mt-1 line-clamp-2 text-base font-semibold text-neutral-900 dark:text-neutral-100">
          {post.title}
        </h3>
        {post.summaryFirstLine ? (
          <p className="mt-1 line-clamp-1 text-sm text-neutral-500 dark:text-neutral-400">{post.summaryFirstLine}</p>
        ) : (
          <p className="mt-1 text-sm text-neutral-400 dark:text-neutral-500">AI 요약 준비 중...</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
            {CATEGORY_LABELS[post.category]}
          </span>
          {post.readStatus ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              {READ_STATUS_LABELS[post.readStatus]}
            </span>
          ) : null}
        </div>

        <div className="mt-3 flex items-center gap-3 text-xs text-neutral-400 dark:text-neutral-500">
          <span>{post.bookmarked ? "★" : "☆"} {post.bookmarkCount}</span>
          <span>💬 {post.commentCount}</span>
        </div>
      </Link>
    </div>
  );
}
