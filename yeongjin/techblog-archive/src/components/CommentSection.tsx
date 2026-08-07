"use client";

import { useActionState, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCommentAction, deleteCommentAction } from "@/lib/actions/comments";
import { formatRelativeDate } from "@/lib/labels";

type CommentData = {
  id: string;
  content: string;
  createdAt: Date;
  authorId: string;
  author: { name: string };
  replies: { id: string; content: string; createdAt: Date; authorId: string; author: { name: string } }[];
};

export function CommentSection({ postId, comments, currentUserId }: { postId: string; comments: CommentData[]; currentUserId: string }) {
  const boundCreate = createCommentAction.bind(null, postId);
  const [state, formAction, pending] = useActionState(boundCreate, undefined);

  return (
    <div className="flex flex-col gap-4">
      <form action={formAction} className="flex flex-col gap-2">
        <textarea
          name="content"
          required
          rows={2}
          placeholder="이 글에 대한 의견을 남겨보세요"
          className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
        />
        {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
        <button
          type="submit"
          disabled={pending}
          className="self-end rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-strong disabled:opacity-60"
        >
          댓글 작성
        </button>
      </form>

      {comments.length === 0 ? (
        <p className="text-sm text-neutral-400">아직 댓글이 없습니다. 첫 댓글을 남겨보세요.</p>
      ) : (
        <ul className="flex flex-col gap-4">
          {comments.map((c) => (
            <CommentItem key={c.id} postId={postId} comment={c} currentUserId={currentUserId} />
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentItem({ postId, comment, currentUserId }: { postId: string; comment: CommentData; currentUserId: string }) {
  const [replying, setReplying] = useState(false);
  const boundReply = createCommentAction.bind(null, postId);
  const [replyState, replyAction, replyPending] = useActionState(boundReply, undefined);

  return (
    <li className="rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
      <CommentRow postId={postId} id={comment.id} authorName={comment.author.name} content={comment.content} createdAt={comment.createdAt} authorId={comment.authorId} currentUserId={currentUserId} />

      <button type="button" onClick={() => setReplying((v) => !v)} className="mt-2 text-xs text-neutral-400 hover:underline">
        답글 달기
      </button>

      {replying ? (
        <form
          action={(fd) => {
            fd.set("parentId", comment.id);
            replyAction(fd);
          }}
          className="mt-2 flex flex-col gap-2"
        >
          <textarea
            name="content"
            required
            rows={2}
            placeholder="답글을 입력하세요"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          {replyState?.error ? <p className="text-xs text-red-600">{replyState.error}</p> : null}
          <button
            type="submit"
            disabled={replyPending}
            className="self-end rounded-full border border-neutral-300 px-3 py-1 text-xs font-semibold dark:border-neutral-700"
          >
            답글 등록
          </button>
        </form>
      ) : null}

      {comment.replies.length > 0 ? (
        <ul className="mt-3 flex flex-col gap-2 border-l-2 border-neutral-100 pl-3 dark:border-neutral-800">
          {comment.replies.map((r) => (
            <li key={r.id}>
              <CommentRow postId={postId} id={r.id} authorName={r.author.name} content={r.content} createdAt={r.createdAt} authorId={r.authorId} currentUserId={currentUserId} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  );
}

function CommentRow({
  postId,
  id,
  authorName,
  content,
  createdAt,
  authorId,
  currentUserId,
}: {
  postId: string;
  id: string;
  authorName: string;
  content: string;
  createdAt: Date;
  authorId: string;
  currentUserId: string;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{authorName}</p>
        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-400">{formatRelativeDate(createdAt)}</span>
          {authorId === currentUserId ? (
            <button
              type="button"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  await deleteCommentAction(postId, id);
                  router.refresh();
                })
              }
              className="text-xs text-neutral-400 hover:text-red-500"
            >
              삭제
            </button>
          ) : null}
        </div>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">{content}</p>
    </div>
  );
}
