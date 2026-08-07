"use client";

import { useActionState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  joinDiscussionAction,
  leaveDiscussionAction,
  closeDiscussionAction,
  postDiscussionMessageAction,
} from "@/lib/actions/discussions";

export function JoinLeaveButton({ discussionId, isParticipant, disabled }: { discussionId: string; isParticipant: boolean; disabled?: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (disabled) return null;

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          if (isParticipant) {
            await leaveDiscussionAction(discussionId);
          } else {
            await joinDiscussionAction(discussionId);
          }
          router.refresh();
        })
      }
      className={`rounded-full px-4 py-1.5 text-sm font-semibold ${
        isParticipant
          ? "border border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300"
          : "bg-violet-600 text-white hover:bg-violet-700"
      }`}
    >
      {isParticipant ? "참여 취소" : "참여하기"}
    </button>
  );
}

export function CloseDiscussionButton({ discussionId }: { discussionId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("토론을 종료할까요?")) return;
        startTransition(async () => {
          await closeDiscussionAction(discussionId);
          router.refresh();
        });
      }}
      className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900"
    >
      토론 종료
    </button>
  );
}

export function DiscussionMessageForm({ discussionId }: { discussionId: string }) {
  const boundAction = postDiscussionMessageAction.bind(null, discussionId);
  const [state, formAction, pending] = useActionState(boundAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <textarea
        name="content"
        required
        rows={2}
        placeholder="의견을 남겨보세요"
        className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
      />
      {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={pending}
        className="self-end rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-strong disabled:opacity-60"
      >
        보내기
      </button>
    </form>
  );
}
