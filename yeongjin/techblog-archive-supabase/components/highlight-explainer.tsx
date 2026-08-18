"use client";

import type { HighlightZone } from "@/lib/db/highlights";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type Mode = "menu" | "note" | "explain";
type Selection = { text: string; x: number; y: number; zone: HighlightZone };

// AI 요약/독후감/원문 본문 각각을 data-zone으로 감싸두면, 드래그한 위치가 어느 영역인지
// 판별해 하이라이트에 함께 저장한다(하이라이트 탭의 "어디에 많이 표시했는지" 분포용).
function resolveZone(node: Node | null): HighlightZone {
  const el = node instanceof Element ? node : node?.parentElement ?? null;
  const zoneEl = el?.closest("[data-zone]");
  const zone = zoneEl?.getAttribute("data-zone");
  return zone === "ai_summary" || zone === "note" ? zone : "body";
}

export function HighlightExplainer({
  articleId,
  children,
}: {
  articleId: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [mode, setMode] = useState<Mode>("menu");
  const [noteDraft, setNoteDraft] = useState("");
  const [explanation, setExplanation] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const handleMouseUp = () => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text || !containerRef.current || !sel || sel.rangeCount === 0) {
        return;
      }
      const range = sel.getRangeAt(0);
      if (!containerRef.current.contains(range.commonAncestorContainer)) return;

      const rect = range.getBoundingClientRect();
      setSelection({
        text,
        x: rect.left + rect.width / 2,
        y: rect.top + window.scrollY,
        zone: resolveZone(range.commonAncestorContainer),
      });
      setMode("menu");
      setNoteDraft("");
      setExplanation(null);
      setError(null);
    };

    document.addEventListener("mouseup", handleMouseUp);
    return () => document.removeEventListener("mouseup", handleMouseUp);
  }, []);

  const closePopover = () => {
    setSelection(null);
    setMode("menu");
    setNoteDraft("");
    setExplanation(null);
    setError(null);
  };

  const handleExplain = async () => {
    if (!selection) return;
    setMode("explain");
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/explain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: selection.text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "설명을 가져오지 못했어요");
      setExplanation(data.explanation);
    } catch (e) {
      setError(e instanceof Error ? e.message : "설명을 가져오지 못했어요");
    } finally {
      setLoading(false);
    }
  };

  const saveHighlight = async (note: string | null) => {
    if (!selection) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/highlights`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quote: selection.text, note, zone: selection.zone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "형광펜 저장에 실패했어요");
      router.refresh();
      closePopover();
    } catch (e) {
      setError(e instanceof Error ? e.message : "형광펜 저장에 실패했어요");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      {children}

      {selection ? (
        <div
          className="absolute z-50 -translate-x-1/2 -translate-y-full rounded-md border bg-popover p-2 shadow-lg"
          style={{ left: selection.x, top: selection.y }}
        >
          {mode === "menu" ? (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                onClick={() => saveHighlight(null)}
                disabled={loading}
                className="whitespace-nowrap rounded bg-highlight px-2 py-1 text-xs text-highlight-foreground"
              >
                🖍 형광펜 표시
              </button>
              <button
                type="button"
                onClick={() => setMode("note")}
                disabled={loading}
                className="whitespace-nowrap rounded border px-2 py-1 text-xs"
              >
                📝 메모 남기기
              </button>
              <button
                type="button"
                onClick={handleExplain}
                disabled={loading}
                className="whitespace-nowrap rounded bg-primary px-2 py-1 text-xs text-primary-foreground"
              >
                ✨ AI로 쉽게 설명
              </button>
            </div>
          ) : mode === "note" ? (
            <div className="w-56">
              <textarea
                autoFocus
                className="min-h-16 w-full rounded border bg-background p-1.5 text-xs"
                placeholder="이 부분에 대한 메모 (나만 보기)"
                value={noteDraft}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
              <div className="mt-1 flex justify-end gap-2">
                <button
                  type="button"
                  className="text-xs text-muted-foreground underline"
                  onClick={closePopover}
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={loading || !noteDraft.trim()}
                  className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground disabled:opacity-50"
                  onClick={() => saveHighlight(noteDraft.trim())}
                >
                  저장
                </button>
              </div>
            </div>
          ) : (
            <div className="max-w-64 text-xs">
              {error ? <p className="text-destructive">{error}</p> : <p>{explanation}</p>}
              <button
                type="button"
                className="mt-1 text-muted-foreground underline"
                onClick={closePopover}
              >
                닫기
              </button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
