import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import Script from "next/script";
import { Suspense } from "react";
import { AccountSync } from "@/components/common/AccountSync";
import { HeaderBack, NavTrail } from "@/components/common/BackNav";
import { NavTabs } from "@/components/common/NavTabs";
import { HomeReadToggle } from "@/components/common/ReadState";
import "./globals.css";

/** 서비스 전체 폰트 — Pretendard 가변 폰트를 프로젝트에 내장 (CDN 의존 없음) */
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  weight: "45 920",
  display: "swap",
  variable: "--font-pretendard",
});

/** Google Analytics 4 측정 ID (공개되어도 괜찮은 값) */
const GA_ID = "G-VD3QXQHVJY";

export const metadata: Metadata = {
  title: "관점 아카이브 — 기획자를 위한 테크블로그",
  description: "국내 테크 기업 블로그 글을 기획자 관점으로 다시 읽어요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-3 px-4">
            <div className="flex min-w-0 items-center gap-1">
              {/* 글 상세에서만 보이는 "이전" — 글 끝까지 내리지 않아도 바로 돌아가게 */}
              <HeaderBack />
              {/* 워드마크 로고 — 점만 서비스 블루 */}
              <Link href="/" aria-label="INSIGHT 홈" className="text-[22px] font-extrabold leading-none tracking-[-0.04em] text-ink">
                INSIGHT<span className="text-brand">.</span>
              </Link>
            </div>
            <HomeReadToggle />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-6">{children}</main>
        {/* 메뉴(홈·피드·검색·마이)는 PC·모바일 모두 하단 탭바 하나로 둔다 */}
        <NavTabs />
        {/* 지나온 화면 기록("이전" 버튼용) · 내 목록을 계정과 맞추기 — 화면에는 아무것도 안 그린다 */}
        <Suspense fallback={null}>
          <NavTrail />
        </Suspense>
        <AccountSync />
        {/* Google Analytics 4 — 모든 페이지에서 방문·페이지 조회를 수집한다 */}
        <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`} strategy="afterInteractive" />
        <Script id="ga4-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_ID}');`}
        </Script>
      </body>
    </html>
  );
}
