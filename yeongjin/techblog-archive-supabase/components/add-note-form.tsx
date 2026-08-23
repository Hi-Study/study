"use client";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useRouter } from "next/navigation";
import { useState } from "react";

const NOTE_FIELDS = [
  { key: "impressivePart" as const, label: "인상 깊은 부분" },
  { key: "applyIdea" as const, label: "접목하고 싶은 방법" },
  { key: "discussionQuestion" as const, label: "질문 / 토론하고 싶은 것" },
];

// 자동 수집된 글은 등록자가 없어 독후감이 비어있다 — 팀원 누구나 나중에 채울 수 있다(PRD v0.2 4.11).
export function AddNoteForm({ articleId }: { articleId: string }) {
  const router = useRouter();
  const [notes, setNotes] = useState({ impressivePart: "", applyIdea: "", discussionQuestion: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = Object.values(notes).every((v) => v.trim().length >= 20);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/articles/${articleId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notes),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "저장에 실패했어요");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "저장에 실패했어요");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3 rounded-lg border p-4">
      <p className="text-sm font-semibold">아직 독후감이 없어요 — 직접 채워보세요</p>
      {NOTE_FIELDS.map(({ key, label }) => (
        <div className="grid gap-1.5" key={key}>
          <Label htmlFor={key}>{label}</Label>
          <textarea
            id={key}
            className="min-h-20 rounded-md border bg-background p-2 text-sm"
            value={notes[key]}
            onChange={(e) => setNotes((prev) => ({ ...prev, [key]: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">{notes[key].trim().length}/20자 이상</p>
        </div>
      ))}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <Button type="submit" disabled={!canSubmit || isSubmitting}>
        {isSubmitting ? "저장 중…" : "독후감 저장"}
      </Button>
    </form>
  );
}
