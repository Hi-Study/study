"use client";

import type { DraftRecord } from "@/lib/db/drafts";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function DraftItem({ draft }: { draft: DraftRecord }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const title = draft.data.preview?.title || draft.data.url || "제목 없는 초안";
  const updatedAt = new Date(draft.updated_at).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const handleDelete = async () => {
    setDeleting(true);
    await fetch(`/api/drafts/${draft.id}`, { method: "DELETE" });
    router.refresh();
  };

  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border p-3">
      <Link href={`/articles/new?draft=${draft.id}`} className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{updatedAt} 저장됨</p>
      </Link>
      <button
        type="button"
        disabled={deleting}
        onClick={handleDelete}
        className="shrink-0 text-xs text-muted-foreground underline"
      >
        삭제
      </button>
    </div>
  );
}
