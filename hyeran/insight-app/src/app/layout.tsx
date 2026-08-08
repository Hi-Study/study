import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "어노테이션",
  description: "협업 리딩·어노테이션 앱",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <div className="app-shell">{children}</div>
      </body>
    </html>
  );
}
