"use client";

import { useActionState, useState } from "react";
import { useRouter } from "next/navigation";
import { createMemoAction } from "@/lib/actions/memos";
import { MemoDeleteButton, MemoVisibilityToggle } from "@/components/MemoActions";
import { formatRelativeDate } from "@/lib/labels";

type MemoData = {
  id: string;
  content: string;
  noteType: "OPINION" | "NEED_REVIEW" | null;
  isPublic: boolean;
  userId: string;
  createdAt: Date;
  user: { name: string };
};

// 3.10 개인 메모 — 기본 비공개, 메모별 팀 공개 토글
export function MemoSection({ postId, memos, currentUserId }: { postId: string; memos: MemoData[]; currentUserId: string }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const boundCreate = createMemoAction.bind(null, postId);
  const [state, formAction, pending] = useActionState(boundCreate, undefined);

  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-neutral-800 dark:text-neutral-100">개인 메모</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-neutral-500 underline">
          {open ? "취소" : "메모 작성"}
        </button>
      </div>

      {open ? (
        <form
          action={async (fd) => {
            await formAction(fd);
            router.refresh();
          }}
          className="mt-3 flex flex-col gap-2"
        >
          <textarea
            name="content"
            required
            rows={3}
            placeholder="나만 보는 메모를 남겨보세요"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
          <div className="flex items-center justify-between text-xs text-neutral-500">
            <select name="noteType" defaultValue="" className="rounded-md border border-neutral-300 px-2 py-1 dark:border-neutral-700 dark:bg-neutral-950">
              <option value="">유형 선택 안 함</option>
              <option value="OPINION">내 의견</option>
              <option value="NEED_REVIEW">용어·개념 정리 필요</option>
            </select>
            <label className="flex items-center gap-1">
              <input type="checkbox" name="isPublic" /> 팀에 공개
            </label>
          </div>
          {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="self-end rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white hover:bg-primary-strong disabled:opacity-60"
          >
            저장
          </button>
        </form>
      ) : null}

      {memos.length === 0 ? (
        <p className="mt-2 text-sm text-neutral-400">아직 메모가 없습니다.</p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {memos.map((memo) => (
            <li key={memo.id} className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-neutral-600 dark:text-neutral-300">
                  {memo.user.name} · {formatRelativeDate(memo.createdAt)}
                  {memo.noteType ? ` · ${memo.noteType === "OPINION" ? "내 의견" : "정리 필요"}` : ""}
                </p>
                {memo.userId === currentUserId ? (
                  <div className="flex items-center gap-2">
                    <MemoVisibilityToggle memoId={memo.id} isPublic={memo.isPublic} />
                    <MemoDeleteButton memoId={memo.id} />
                  </div>
                ) : (
                  <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    팀에 공개됨
                  </span>
                )}
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm text-neutral-700 dark:text-neutral-200">{memo.content}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
