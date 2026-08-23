"use client";

import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useState } from "react";

// 로그인 방식은 구글 로그인만 지원(확정, PRD v0.2 10.1) — 이메일/비밀번호 방식은 폐기됐다.
export function LoginForm({
  className,
  ...props
}: React.ComponentPropsWithoutRef<"div">) {
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleLogin = async () => {
    const supabase = createClient();
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (error: unknown) {
      setError(error instanceof Error ? error.message : "로그인에 실패했어요");
      setIsLoading(false);
    }
  };

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">로그인</CardTitle>
          <CardDescription>팀 전용 서비스라 구글 계정으로만 로그인할 수 있어요.</CardDescription>
        </CardHeader>
        <CardContent>
          {error && <p className="mb-4 text-sm text-red-500">{error}</p>}
          <Button
            type="button"
            className="w-full"
            onClick={handleGoogleLogin}
            disabled={isLoading}
          >
            {isLoading ? "이동 중…" : "Google로 계속하기"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
