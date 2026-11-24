import type { Metadata } from "next";
import Link from "next/link";
import { LoggedInRedirect, LoginBackLink } from "@/components/common/BackNav";
import { GoogleMark } from "@/components/common/GoogleMark";
import { TrackedAnchor } from "@/components/common/TrackedAnchor";
import { authConfig, currentUser, safeNext } from "@/core/shared/auth";

export const metadata: Metadata = { title: "로그인" };

/** 글 상세·마이에 로그인 없이 들어오면 proxy 가 여기로 보낸다(?next=가려던 주소) */
export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const ready = !!authConfig();
  // 이미 로그인함 — 보통 로그인한 뒤 "뒤로"로 되돌아온 경우. 로그인 전에 있던 화면으로 보낸다
  if (ready && (await currentUser())) return <LoggedInRedirect next={next} />;

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
        // 라우트 핸들러로 가는 링크라 Link(미리 불러오기)가 아니라 a 로 둔다. 누르면 GA login_start 를 보낸다
        <TrackedAnchor
          event="login_start"
          params={{ method: "google" }}
          href={`/auth/google?next=${encodeURIComponent(next)}`}
          className="mt-8 flex w-full items-center justify-center gap-2.5 rounded-2xl border border-line bg-surface py-4 font-bold text-ink transition hover:border-ink-3"
        >
          <GoogleMark />
          Google로 계속하기
        </TrackedAnchor>
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

      {/* 로그인하지 않고 돌아가기 — 홈이 아니라 직전에 있던 화면(검색 결과 등)으로 */}
      <LoginBackLink next={next} className="mt-10 text-sm font-semibold text-ink-2 transition hover:text-ink" />
    </div>
  );
}
