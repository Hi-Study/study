"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";

/**
 * "이전으로" — 브라우저 기록 대신 우리 사이트 안에서 지나온 화면(발자취)을 따로 적어 두고 그걸로 돌아간다.
 *
 * 왜: 로그인을 거치면 브라우저 기록에 로그인 화면·구글 화면이 끼어 있어서, 그냥 "뒤로"를 누르면 로그인 화면이나 홈으로 간다.
 * 발자취에는 로그인·인증 화면을 적지 않으므로, 검색 → (로그인) → 글 상세 → 이전 이면 검색 결과로 돌아간다.
 *
 * 한 칸 = { url: 경로+검색어, spa: 바로 앞 칸에서 화면 안 이동(새로고침 없이)으로 왔는지 }
 * - spa 면 router.back() — 브라우저가 기억한 화면과 스크롤 위치까지 그대로 돌아간다.
 * - 아니면(로그인 뒤 새로 열림 등) 앞 칸 주소로 이동한다. 검색어는 주소(?q=)에 있어 결과가 그대로 다시 나온다.
 * 발자취는 탭마다 따로(sessionStorage), 30칸까지.
 */
type Step = { url: string; spa: boolean };
const TRAIL_KEY = "tbp:trail";
const SKIP = (path: string) => path === "/login" || path.startsWith("/auth/");

function readTrail(): Step[] {
  try {
    return JSON.parse(sessionStorage.getItem(TRAIL_KEY) ?? "[]") as Step[];
  } catch {
    return [];
  }
}
function writeTrail(t: Step[]) {
  try {
    sessionStorage.setItem(TRAIL_KEY, JSON.stringify(t.slice(-30)));
  } catch {}
}

let mounted = false; // 이 탭에서 화면을 새로 연 뒤 첫 기록인지(= spa 아님)

/** 레이아웃에 하나 — 주소가 바뀔 때마다 발자취에 적는다 */
export function NavTrail() {
  const path = usePathname();
  const search = useSearchParams().toString();
  useEffect(() => {
    const spa = mounted;
    mounted = true;
    if (SKIP(path)) return;
    const url = search ? `${path}?${search}` : path;
    const t = readTrail();
    if (t.at(-1)?.url === url) return; // 새로고침
    if (t.at(-2)?.url === url) t.pop(); // 뒤로 가기로 앞 칸에 돌아옴
    else t.push({ url, spa });
    writeTrail(t);
  }, [path, search]);
  return null;
}

/**
 * 돌아갈 칸 — 지금 화면을 빼고, skip(로그인 화면이 가려던 글)도 빼고 바로 앞 칸.
 * viaHistory: 지금 화면에 화면 안 이동으로 왔다 = 브라우저 "뒤로"가 바로 그 칸이다
 */
function previous(skip?: string): { step: Step | undefined; viaHistory: boolean } {
  const t = readTrail();
  const here = window.location.pathname + window.location.search;
  let i = t.length - 1;
  let viaHistory = false;
  if (t[i]?.url === here) {
    viaHistory = t[i].spa;
    i--;
  }
  if (skip && t[i]?.url === skip) {
    viaHistory = false;
    i--;
  }
  return { step: t[i], viaHistory };
}

function useGoBack(fallback: string) {
  const router = useRouter();
  return () => {
    const { step, viaHistory } = previous();
    if (step && viaHistory) router.back();
    else router.push(step?.url ?? fallback);
  };
}

/** 맨 위 고정 바 왼쪽의 "이전" — 글 상세에서만 보인다(글 끝까지 내리지 않아도 바로 돌아가게) */
export function HeaderBack() {
  const path = usePathname();
  const goBack = useGoBack("/feed");
  if (!path.startsWith("/articles/")) return null;
  return (
    <button
      onClick={goBack}
      aria-label="이전 화면으로"
      className="-ml-2 grid size-9 shrink-0 place-items-center rounded-full text-ink-2 transition hover:bg-bg hover:text-ink"
    >
      <svg viewBox="0 0 24 24" aria-hidden className="size-6" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 5l-7 7 7 7" />
      </svg>
    </button>
  );
}

/** 글 끝의 "← 이전으로" (예전 "피드로 돌아가기") */
export function BackLink({ className }: { className?: string }) {
  const goBack = useGoBack("/feed");
  return (
    <button onClick={goBack} className={className}>
      ← 이전으로 돌아가기
    </button>
  );
}

/**
 * 로그인 화면 — 로그인하지 않고 돌아가기. 가려던 글(next)은 로그인이 필요하니 그 앞 화면으로 간다.
 * 로그인 화면은 브라우저 기록에서 지운다(replace) — 돌아간 뒤 "뒤로"를 눌러 다시 로그인 화면이 뜨지 않게.
 */
export function LoginBackLink({ next, className }: { next: string; className?: string }) {
  const router = useRouter();
  return (
    <button onClick={() => router.replace(previous(next).step?.url ?? "/")} className={className}>
      ← 이전으로 돌아가기
    </button>
  );
}

/**
 * 이미 로그인한 채로 로그인 화면에 왔을 때 — 보통 로그인한 뒤 "뒤로"를 눌러 되돌아온 경우다.
 * 가려던 글(next)로 다시 보내면 "뒤로"가 제자리걸음이 되므로, 로그인 전에 있던 화면으로 보낸다(없으면 next).
 */
export function LoggedInRedirect({ next }: { next: string }) {
  const router = useRouter();
  useEffect(() => {
    router.replace(previous(next).step?.url ?? next);
  }, [router, next]);
  return <p className="pt-14 text-center text-sm text-ink-3">이미 로그인했어요. 이전 화면으로 돌아가는 중…</p>;
}
