import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "테크 블로그 아카이빙",
  description: "팀 전용 기술 블로그 아카이빙 · 토론 서비스",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* Pretendard — Wanted Montage 디자인 시스템 기준 폰트 */}
        <link rel="preconnect" href="https://cdn.jsdelivr.net" />
        <link
          rel="stylesheet"
          as="style"
          crossOrigin="anonymous"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard-dynamic-subset.min.css"
        />
      </head>
      <body className="min-h-full flex flex-col bg-neutral-50 dark:bg-neutral-950">{children}</body>
    </html>
  );
}
