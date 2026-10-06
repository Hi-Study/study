import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import { NavTabs } from "@/components/common/NavTabs";
import "./globals.css";

/** 서비스 전체 폰트 — Pretendard 가변 폰트를 프로젝트에 내장 (CDN 의존 없음) */
const pretendard = localFont({
  src: "../../node_modules/pretendard/dist/web/variable/woff2/PretendardVariable.woff2",
  weight: "45 920",
  display: "swap",
  variable: "--font-pretendard",
});

export const metadata: Metadata = {
  title: "관점 아카이브 — 기획자를 위한 테크블로그",
  description: "국내 테크 기업 블로그 글을 기획자 관점으로 다시 읽어요.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className={pretendard.variable}>
      <body className="min-h-dvh">
        <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
            <Link href="/" className="flex items-center gap-2 font-bold tracking-tight">
              <span className="grid size-7 place-items-center rounded-lg bg-brand text-sm text-white">✦</span>
              관점 아카이브
            </Link>
            <NavTabs variant="top" />
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-4 pb-28 pt-6 md:pb-16">{children}</main>
        <NavTabs variant="bottom" />
      </body>
    </html>
  );
}
