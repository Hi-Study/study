"use client";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { HighlightRecord, HighlightZone } from "@/lib/db/highlights";
import { MoreVertical } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const ZONE_LABEL: Record<HighlightZone, string> = {
  ai_summary: "AI 요약",
  note: "독후감",
  body: "본문",
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ko-KR", { month: "numeric", day: "numeric" });
}

export function HighlightCard({ highlight }: { highlight: HighlightRecord }) {
  const router = useRouter();
  const [removed, setRemoved] = useState(false);

  const remove = async () => {
    setRemoved(true);
    await fetch(`/api/highlights/${highlight.id}`, { method: "DELETE" });
    router.refresh();
  };

  if (removed) return null;

  return (
    <div className="border-b p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge variant="highlight">{ZONE_LABEL[highlight.zone]}</Badge>
          <span className="text-xs text-muted-foreground">{formatDate(highlight.created_at)}</span>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger aria-label="더보기">
            <MoreVertical className="h-4 w-4 text-muted-foreground" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={remove} className="text-destructive">
              삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <blockquote className="mt-2 border-l-2 border-highlight pl-3 text-sm italic text-muted-foreground">
        &quot;{highlight.quote}&quot;
      </blockquote>
      {highlight.note ? <p className="mt-2 text-sm">{highlight.note}</p> : null}
    </div>
  );
}
