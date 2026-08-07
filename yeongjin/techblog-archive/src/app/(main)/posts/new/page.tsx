"use client";

import { useActionState } from "react";
import { registerPostAction } from "@/lib/actions/posts";
import { CATEGORY_OPTIONS } from "@/lib/labels";

export default function NewPostPage() {
  const [state, formAction, pending] = useActionState(registerPostAction, undefined);

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-lg font-bold text-neutral-900 dark:text-neutral-100">글 등록</h1>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          카테고리와 원문 URL만 있으면 등록할 수 있어요. 등록 노트는 권장이지만 건너뛰어도 됩니다.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4 rounded-xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
        <div>
          <label className="mb-1 block text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            카테고리 <span className="text-red-500">*</span>
          </label>
          <select
            name="category"
            required
            defaultValue=""
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          >
            <option value="" disabled>
              카테고리를 선택하세요
            </option>
            {CATEGORY_OPTIONS.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold text-neutral-700 dark:text-neutral-200">
            원문 URL <span className="text-red-500">*</span>
          </label>
          <input
            name="url"
            type="url"
            required
            placeholder="https://techblog.example.com/posts/1"
            className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
          />
        </div>

        <div className="rounded-lg bg-neutral-50 p-3 dark:bg-neutral-800">
          <p className="mb-2 text-sm font-semibold text-neutral-700 dark:text-neutral-200">등록 노트 (권장, 건너뛰기 가능)</p>

          <div className="flex flex-col gap-3">
            <div>
              <label className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">
                이 글에서 얻은 핵심 인사이트는? (20자 이상 권장)
              </label>
              <textarea
                name="insight"
                rows={2}
                placeholder="예) 대용량 트래픽 상황에서 캐시 계층을 어떻게 설계했는지가 인상 깊었다"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">
                이해/추가 조사를 위해 정리가 필요한 개념·용어는?
              </label>
              <textarea
                name="technical"
                rows={2}
                placeholder="예) 컨시스턴트 해싱, 서킷 브레이커 패턴"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">
                우리 팀/내 업무에 바로 적용해볼 수 있는 부분은?
              </label>
              <textarea
                name="applied"
                rows={2}
                placeholder="예) 배포 파이프라인에 카나리 배포 단계를 추가해볼 수 있을 것 같다"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950"
              />
            </div>
          </div>
        </div>

        {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-primary py-2.5 text-sm font-semibold text-white hover:bg-primary-strong disabled:opacity-60"
        >
          {pending ? "본문을 가져오는 중..." : "등록하기"}
        </button>
      </form>
    </div>
  );
}
