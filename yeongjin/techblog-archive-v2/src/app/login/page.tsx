import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { authConfig, currentUser, safeNext } from "@/core/shared/auth";

export const metadata: Metadata = { title: "로그인 — INSIGHT" };

/** 글 상세·마이에 로그인 없이 들어오면 proxy 가 여기로 보낸다(?next=가려던 주소) */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const ready = !!authConfig();
  if (ready && (await currentUser())) redirect(next);

  return (
    <div className="mx-auto flex max-w-sm flex-col items-center pt-14 text-center">
      <h1 className="text-2xl font-bold tracking-tight">로그인하고 글 읽기</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">
        한눈에 보기 · 기획 포인트 · 읽기 전에 알아두면 좋은 개념은
        <br />
        로그인하면 볼 수 있어요
      </p>

      {typeof sp.error === "string" && (
        <p className="mt-6 w-full rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand">
          로그인을 마치지 못했어요. 다시 시도해 주세요.
        </p>
      )}

      {ready ? (
        // 라우트 핸들러로 가는 링크라 Link(미리 불러오기)가 아니라 a 로 둔다
        <a
          href={`/auth/google?next=${encodeURIComponent(next)}`}
          className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-line bg-surface py-4 font-bold text-ink transition hover:border-ink-3"
        >
          <GoogleMark />
          Google로 계속하기
        </a>
      ) : (
        <p className="mt-8 w-full rounded-xl bg-before px-4 py-3 text-sm text-ink-2">
          로그인 설정이 아직 안 됐어요. 배포 환경변수에 <b>SUPABASE_ANON_KEY</b> 를 넣어 주세요.
        </p>
      )}
      <p className="mt-3 text-xs text-ink-3">
        계속하면{" "}
        <Link href="/privacy" className="underline underline-offset-2">
          개인정보처리방침
        </Link>
        에 동의하는 것으로 봐요
      </p>

      <Link href="/" className="mt-10 text-sm font-semibold text-ink-2 transition hover:text-ink">
        ← 홈으로 돌아가기
      </Link>
    </div>
  );
}

/** 구글 공식 G 로고 — 로그인 버튼에는 구글 브랜드 가이드대로 원래 색을 쓴다 */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden className="size-5">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
