import type { HighlightRecord, HighlightZone } from "@/lib/db/highlights";

const ZONES: { key: HighlightZone; label: string }[] = [
  { key: "body", label: "본문" },
  { key: "ai_summary", label: "AI 요약" },
  { key: "note", label: "독후감" },
];

// "어디에 많이 표시했는지" — 페이지 번호가 없는 글이라 콘텐츠 3영역 기준 분포로 대체한다.
export function HighlightDistribution({ highlights }: { highlights: HighlightRecord[] }) {
  const counts: Record<HighlightZone, number> = { body: 0, ai_summary: 0, note: 0 };
  for (const h of highlights) counts[h.zone] = (counts[h.zone] ?? 0) + 1;
  const max = Math.max(1, ...ZONES.map((z) => counts[z.key]));

  return (
    <div className="flex flex-col gap-2.5">
      {ZONES.map((zone) => {
        const count = counts[zone.key];
        const widthPct = count > 0 ? Math.max(Math.round((count / max) * 100), 8) : 0;
        return (
          <div key={zone.key} className="flex items-center gap-3">
            <span className="w-14 shrink-0 text-xs text-muted-foreground">{zone.label}</span>
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-highlight transition-all"
                style={{ width: `${widthPct}%` }}
              />
            </div>
            <span className="w-5 shrink-0 text-right text-xs font-medium">{count}</span>
          </div>
        );
      })}
    </div>
  );
}
