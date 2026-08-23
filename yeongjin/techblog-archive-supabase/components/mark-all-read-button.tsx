"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function MarkAllReadButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    await fetch("/api/notifications", { method: "POST" });
    router.refresh();
    setLoading(false);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="text-xs text-muted-foreground underline"
    >
      모두 읽음으로 표시
    </button>
  );
}
