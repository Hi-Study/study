"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleKeywordChipAction } from "@/lib/actions/curation";

export function KeywordChipButton({ chipId, label, initialSelected }: { chipId: string; label: string; initialSelected: boolean }) {
  const [selected, setSelected] = useState(initialSelected);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        setSelected((v) => !v);
        startTransition(async () => {
          await toggleKeywordChipAction(chipId);
          router.refresh();
        });
      }}
      className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
        selected
          ? "border-violet-500 bg-violet-500 text-white"
          : "border-neutral-300 text-neutral-600 hover:bg-neutral-50 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
      }`}
    >
      {label}
    </button>
  );
}
