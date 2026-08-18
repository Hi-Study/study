"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function SummarizeButton({
  articleId,
  label = "AI 요약 생성",
  loadingLabel = "생성 중…",
  variant = "outline",
}: {
  articleId: string;
  label?: string;
  loadingLabel?: string;
  variant?: "outline" | "link";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ articleId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "요약 생성에 실패했어요");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "요약 생성에 실패했어요");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <Button type="button" size="sm" variant={variant} onClick={handleClick} disabled={loading}>
        {loading ? loadingLabel : label}
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
