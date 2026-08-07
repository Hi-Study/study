"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { regenerateSummaryAction } from "@/lib/actions/posts";

type SummaryData = {
  status: "PENDING" | "READY" | "FAILED";
  lines: unknown;
  keywords: unknown;
  recommendFor: string | null;
  errorMessage: string | null;
} | null;

// 3.7 AI 요약
export function SummaryBox({ postId, summary }: { postId: string; summary: SummaryData }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const lines = Array.isArray(summary?.lines) ? (summary.lines as string[]) : [];
  const keywords = Array.isArray(summary?.keywords) ? (summary.keywords as string[]) : [];

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50 p-4 dark:border-sky-900 dark:bg-sky-950/40">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-sky-900 dark:text-sky-200">AI 요약</h2>
        {summary && summary.status !== "PENDING" ? (
          <button
            type="button"
            disabled={isPending}
            onClick={() =>
              startTransition(async () => {
                await regenerateSummaryAction(postId);
                router.refresh();
              })
            }
            className="text-xs text-sky-700 underline disabled:opacity-60 dark:text-sky-300"
          >
            {isPending ? "다시 생성 중..." : "다시 요약하기"}
          </button>
        ) : null}
      </div>

      {!summary || summary.status === "PENDING" ? (
        <p className="mt-2 text-sm text-sky-700 dark:text-sky-300">요약 준비 중... 잠시 후 새로고침해주세요.</p>
      ) : summary.status === "FAILED" ? (
        <p className="mt-2 text-sm text-red-600">요약 생성에 실패했습니다: {summary.errorMessage}</p>
      ) : (
        <div className="mt-2 flex flex-col gap-2">
          <ul className="list-disc pl-5 text-sm text-neutral-700 dark:text-neutral-200">
            {lines.map((line, idx) => (
              <li key={idx}>{line}</li>
            ))}
          </ul>
          {keywords.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((kw) => (
                <span key={kw} className="rounded-full bg-white px-2 py-0.5 text-xs text-sky-700 dark:bg-black/20 dark:text-sky-300">
                  #{kw}
                </span>
              ))}
            </div>
          ) : null}
          {summary.recommendFor ? (
            <p className="text-xs text-sky-600 dark:text-sky-400">💡 이런 분께 추천: {summary.recommendFor}</p>
          ) : null}
        </div>
      )}
    </div>
  );
}
