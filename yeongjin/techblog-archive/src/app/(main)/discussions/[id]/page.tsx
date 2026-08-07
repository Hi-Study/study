import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getDiscussionDetail } from "@/lib/queries";
import { DISCUSSION_STATUS_LABELS, formatRelativeDate } from "@/lib/labels";
import { JoinLeaveButton, CloseDiscussionButton, DiscussionMessageForm } from "@/components/DiscussionActions";

export default async function DiscussionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const userId = session!.user.id;

  const detail = await getDiscussionDetail(id, userId);
  if (!detail) notFound();

  const { discussion, isParticipant } = detail;
  const isRequester = discussion.requesterId === userId;
  const isClosed = discussion.status === "CLOSED";

  return (
    <div className="flex flex-col gap-4">
      <Link href={`/posts/${discussion.post.id}`} className="text-sm text-neutral-400 hover:underline">
        ← {discussion.post.title}
      </Link>

      <div>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-1 text-xs font-medium ${
              isClosed
                ? "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                : discussion.status === "IN_PROGRESS"
                  ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
            }`}
          >
            {DISCUSSION_STATUS_LABELS[discussion.status]}
          </span>
          <span className="text-xs text-neutral-400">
            {discussion.requester.name} 신청 · {formatRelativeDate(discussion.createdAt)}
          </span>
        </div>
        <h1 className="mt-2 text-lg font-bold text-neutral-900 dark:text-neutral-100">{discussion.topic}</h1>
        <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">{discussion.reason}</p>
      </div>

      <div className="flex items-center gap-2">
        <JoinLeaveButton discussionId={discussion.id} isParticipant={isParticipant} disabled={isClosed} />
        {isRequester && !isClosed ? <CloseDiscussionButton discussionId={discussion.id} /> : null}
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">
          참여자 {discussion.participants.length}명
        </p>
        <div className="flex flex-wrap gap-1.5">
          {discussion.participants.map((p) => (
            <span key={p.id} className="rounded-full bg-neutral-100 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
              {p.user.name}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-neutral-200 p-4 dark:border-neutral-800">
        {discussion.messages.length === 0 ? (
          <p className="text-sm text-neutral-400">아직 메시지가 없습니다.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {discussion.messages.map((m) => (
              <li key={m.id}>
                <p className="text-xs font-semibold text-neutral-600 dark:text-neutral-300">
                  {m.author.name} · {formatRelativeDate(m.createdAt)}
                </p>
                <p className="mt-0.5 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-200">{m.content}</p>
              </li>
            ))}
          </ul>
        )}

        {!isClosed ? <DiscussionMessageForm discussionId={discussion.id} /> : <p className="text-xs text-neutral-400">종료된 토론입니다.</p>}
      </div>
    </div>
  );
}
