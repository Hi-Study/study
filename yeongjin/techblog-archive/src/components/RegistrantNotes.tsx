"use client";

import { useActionState, useState } from "react";
import { addRegistrantNoteAction } from "@/lib/actions/posts";
import { formatRelativeDate } from "@/lib/labels";

type NoteData = {
  id: string;
  insight: string;
  technical: string | null;
  applied: string | null;
  createdAt: Date;
  author: { name: string };
};

// 3.1, 3.4 등록자의 노트 — 여러 팀원이 각자 노트를 추가하면 작성자·작성일이 표시된 카드로 누적
export function RegistrantNotes({ postId, notes }: { postId: string; notes: NoteData[] }) {
  const [open, setOpen] = useState(false);
  const boundAdd = addRegistrantNoteAction.bind(null, postId);
  const [state, formAction, pending] = useActionState(boundAdd, undefined);

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/40">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-amber-900 dark:text-amber-200">등록자의 노트</h2>
        <button type="button" onClick={() => setOpen((v) => !v)} className="text-xs text-amber-700 underline dark:text-amber-300">
          {open ? "취소" : "노트 추가하기"}
        </button>
      </div>

      {open ? (
        <form action={formAction} className="mt-3 flex flex-col gap-2">
          <textarea
            name="insight"
            required
            rows={2}
            placeholder="핵심 인사이트"
            className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-900 dark:bg-neutral-950"
          />
          <textarea
            name="technical"
            rows={2}
            placeholder="정리해야 할 기술 지식 (선택)"
            className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-900 dark:bg-neutral-950"
          />
          <textarea
            name="applied"
            rows={2}
            placeholder="바로 적용할 수 있는 점 (선택)"
            className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm dark:border-amber-900 dark:bg-neutral-950"
          />
          {state?.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
          <button
            type="submit"
            disabled={pending}
            className="self-end rounded-full bg-amber-600 px-4 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          >
            노트 저장
          </button>
        </form>
      ) : null}

      {notes.length === 0 ? (
        <p className="mt-2 text-sm text-amber-700/80 dark:text-amber-300/80">
          {open ? null : "아직 등록자 노트가 없습니다. 첫 노트를 남겨보세요."}
        </p>
      ) : (
        <div className="mt-3 flex flex-col gap-3">
          {notes.map((note) => (
            <div key={note.id} className="rounded-lg bg-white/70 p-3 dark:bg-black/20">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300">
                {note.author.name} · {formatRelativeDate(note.createdAt)}
              </p>
              <dl className="mt-1 flex flex-col gap-1 text-sm text-neutral-700 dark:text-neutral-200">
                <div>
                  <dt className="inline font-medium text-amber-900 dark:text-amber-200">핵심 인사이트: </dt>
                  <dd className="inline">{note.insight}</dd>
                </div>
                {note.technical ? (
                  <div>
                    <dt className="inline font-medium text-amber-900 dark:text-amber-200">정리할 기술 지식: </dt>
                    <dd className="inline">{note.technical}</dd>
                  </div>
                ) : null}
                {note.applied ? (
                  <div>
                    <dt className="inline font-medium text-amber-900 dark:text-amber-200">바로 적용할 점: </dt>
                    <dd className="inline">{note.applied}</dd>
                  </div>
                ) : null}
              </dl>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
