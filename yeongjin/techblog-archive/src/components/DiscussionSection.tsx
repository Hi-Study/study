"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { createDiscussionAction } from "@/lib/actions/discussions";
import { DISCUSSION_STATUS_LABELS, formatRelativeDate } from "@/lib/labels";
import type { DiscussionStatus } from "@/generated/prisma/enums";

type DiscussionData = {
  id: string;
  topic: string;
  status: DiscussionStatus;
  createdAt: Date;
  requester: { name: string };
  participants: { id: string }[];
};

export function DiscussionSection({ postId, discussions }: { postId: string; discussions: DiscussionData[] }) {
  const [open, setOpen] = useState(false);
  const boundCreate = createDiscussionAction.bind(null, postId);
  const [state, formAction, pending] = useActionState(boundCreate, undefined);

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="self-start rounded-full bg-violet-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-violet-700"
      >
        {open ? "취소" : "토론 신청하기"}
      </button>

      {open ? (
        <form action={formAction} className="flex flex-col gap-2 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800">
          <input
            name="topic"
            required
            placeholder="토론 주제 (예: 캐시 무효화 전략, 우리 팀에 적용할 수 있을까?)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <textarea
            name="reason"
            required
            rows={3}
            placeholder="이 글의 어떤 부분에 대해 왜 이야기하고 싶은지 적어주세요"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="self-end rounded-full bg-primary px-4 py-1.5 text-sm font-semibold text-white hover:bg-primary-strong disabled:opacity-60"
          >
            신청 완료
          </button>
        </form>
      ) : null}

      {discussions.length === 0 ? (
        <p className="text-sm text-neutral-400">아직 신청된 토론이 없습니다.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {discussions.map((d) => (
            <li key={d.id}>
              <Link
                href={`/discussions/${d.id}`}
                className="flex items-center justify-between rounded-lg border border-neutral-200 p-3 hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800"
              >
                <div>
                  <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{d.topic}</p>
                  <p className="text-xs text-neutral-400">
                    {d.requester.name} · 참여 {d.participants.length}명 · {formatRelativeDate(d.createdAt)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                    d.status === "CLOSED"
                      ? "bg-neutral-100 text-neutral-500 dark:bg-neutral-800"
                      : d.status === "IN_PROGRESS"
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                        : "bg-sky-50 text-sky-700 dark:bg-sky-950 dark:text-sky-300"
                  }`}
                >
                  {DISCUSSION_STATUS_LABELS[d.status]}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
