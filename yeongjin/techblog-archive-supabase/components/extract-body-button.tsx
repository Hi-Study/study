"use client";

import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ExtractBodyButton({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/extract-body`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "본문을 가져오지 못했어요");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "본문을 가져오지 못했어요");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-2">
      <Button type="button" size="sm" variant="outline" onClick={handleClick} disabled={loading}>
        {loading ? "불러오는 중…" : "본문 불러오기"}
      </Button>
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
