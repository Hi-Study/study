import { AuthButton } from "@/components/auth-button";
import { EnvVarWarning } from "@/components/env-var-warning";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { Button } from "@/components/ui/button";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { Suspense } from "react";

const SERVICE_NAME = process.env.NEXT_PUBLIC_SERVICE_NAME || "테크아카이브";

export default function LandingPage() {
  return (
    <main className="min-h-screen flex flex-col items-center">
      <div className="flex-1 w-full flex flex-col gap-20 items-center">
        <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
          <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
            <Link href="/" className="font-semibold">
              {SERVICE_NAME}
            </Link>
            {!hasEnvVars ? (
              <EnvVarWarning />
            ) : (
              <Suspense>
                <AuthButton />
              </Suspense>
            )}
          </div>
        </nav>

        <div className="flex-1 flex flex-col gap-8 max-w-xl p-5 text-center items-center">
          <h1 className="text-3xl lg:text-4xl font-bold !leading-tight">
            팀이 함께 모으고, 읽고, 토론하는
            <br />
            테크블로그 아카이브
          </h1>
          <p className="text-muted-foreground text-lg">
            흩어진 기술 블로그 글을 팀 전용 공간에 모으고, AI 요약과 쉬운 설명으로
            어려운 글도 끝까지 읽어요. 팀원 초대를 받은 분만 로그인해 사용할 수
            있어요.
          </p>
          <div className="flex gap-3">
            <Button asChild size="lg">
              <Link href="/auth/login">Google로 시작하기</Link>
            </Button>
          </div>
        </div>

        <footer className="w-full flex items-center justify-center border-t mx-auto text-center text-xs gap-8 py-16">
          <p>{SERVICE_NAME} · 팀 전용 아카이빙 서비스</p>
          <ThemeSwitcher />
        </footer>
      </div>
    </main>
  );
}
