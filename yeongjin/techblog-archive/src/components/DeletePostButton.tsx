"use client";

import { useTransition } from "react";
import { softDeletePostAction } from "@/lib/actions/posts";

export function DeletePostButton({ postId }: { postId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        if (!confirm("이 글을 삭제할까요? 유예기간 동안은 목록에서 숨겨지며 이후 복구 가능합니다.")) return;
        startTransition(async () => {
          await softDeletePostAction(postId);
        });
      }}
      className="rounded-full border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-red-900 dark:hover:bg-red-950"
    >
      삭제
    </button>
  );
}
