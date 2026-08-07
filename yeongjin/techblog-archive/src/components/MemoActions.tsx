"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteMemoAction, toggleMemoVisibilityAction } from "@/lib/actions/memos";

export function MemoDeleteButton({ memoId }: { memoId: string }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("이 메모를 삭제할까요?")) return;
        startTransition(async () => {
          await deleteMemoAction(memoId);
          router.refresh();
        });
      }}
      className="text-xs text-neutral-400 hover:text-red-500"
    >
      삭제
    </button>
  );
}

export function MemoVisibilityToggle({ memoId, isPublic }: { memoId: string; isPublic: boolean }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          await toggleMemoVisibilityAction(memoId);
          router.refresh();
        });
      }}
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        isPublic
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400"
      }`}
    >
      {isPublic ? "팀에 공개됨" : "비공개"}
    </button>
  );
}
