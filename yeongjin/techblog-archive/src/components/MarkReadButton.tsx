"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { markPostReadAction } from "@/lib/actions/posts";
import { READ_STATUS_LABELS } from "@/lib/labels";
import type { ReadStatus } from "@/generated/prisma/enums";

export function MarkReadButton({ postId, status }: { postId: string; status: ReadStatus }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  if (status === "DONE") {
    return (
      <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
        ✓ {READ_STATUS_LABELS.DONE}
      </span>
    );
  }

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(async () => {
        await markPostReadAction(postId);
        router.refresh();
      })}
      className="rounded-full border border-neutral-300 px-3 py-1.5 text-sm font-medium text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
    >
      읽음으로 표시
    </button>
  );
}
