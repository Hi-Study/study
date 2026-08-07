"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signUpAction } from "@/lib/actions/auth";
import { BrandMark } from "@/components/BrandLogo";

export default function SignUpPage() {
  const [state, formAction, pending] = useActionState(signUpAction, undefined);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-neutral-50 px-4 dark:bg-neutral-950">
      <div className="w-full max-w-sm rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
        <BrandMark className="h-10 w-10" />
        <h1 className="mt-3 text-xl font-bold text-neutral-900 dark:text-neutral-100">회원가입</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">팀 스터디 사이드 프로젝트용 계정을 만드세요</p>

        <form action={formAction} className="mt-6 flex flex-col gap-3">
          <input
            name="name"
            required
            placeholder="이름"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-950"
          />
          <input
            name="email"
            type="email"
            required
            placeholder="이메일"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-950"
          />
          <input
            name="password"
            type="password"
            required
            minLength={8}
            placeholder="비밀번호 (8자 이상)"
            className="rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-primary dark:border-neutral-700 dark:bg-neutral-950"
          />

          {state?.error ? <p className="text-sm text-red-600">{state.error}</p> : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-2 rounded-lg bg-primary py-2 text-sm font-semibold text-white hover:bg-primary-strong disabled:opacity-60"
          >
            {pending ? "가입 중..." : "회원가입"}
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-neutral-500 dark:text-neutral-400">
          이미 계정이 있으신가요? <Link href="/login" className="font-medium text-primary underline">로그인</Link>
        </p>
      </div>
    </div>
  );
}
