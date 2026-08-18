"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DraftRecord } from "@/lib/db/drafts";
import { CATEGORIES } from "@/lib/schemas/article";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { useState } from "react";

type PreviewState = {
  title: string;
  company: string;
  thumbnailUrl: string | null;
} | null;

const NOTE_FIELDS = [
  {
    key: "impressivePart" as const,
    label: "인상 깊은 부분",
    placeholder: "예: 트래픽 급증에 대비한 캐시 전략을 단계적으로 도입한 과정이 인상 깊었다.",
  },
  {
    key: "applyIdea" as const,
    label: "접목하고 싶은 방법",
    placeholder: "예: 우리 서비스의 조회 API에도 캐시 계층을 먼저 붙여볼 수 있겠다.",
  },
  {
    key: "discussionQuestion" as const,
    label: "질문 / 토론하고 싶은 것",
    placeholder: "예: 캐시 무효화 전략(write-through, write-behind) 중 우리 팀엔 뭐가 더 맞을까?",
  },
];

export function ArticleForm({ initialDraft = null }: { initialDraft?: DraftRecord | null }) {
  const router = useRouter();
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [url, setUrl] = useState(initialDraft?.data.url ?? "");
  const [category, setCategory] = useState<string>(initialDraft?.data.category ?? "");
  const [tagsInput, setTagsInput] = useState(initialDraft?.data.tagsInput ?? "");
  const [preview, setPreview] = useState<PreviewState>(initialDraft?.data.preview ?? null);
  const [notes, setNotes] = useState(
    initialDraft?.data.notes ?? {
      impressivePart: "",
      applyIdea: "",
      discussionQuestion: "",
    },
  );
  const [isFetchingPreview, setIsFetchingPreview] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleFetchPreview = async () => {
    setError(null);
    setIsFetchingPreview(true);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "미리보기를 가져오지 못했어요");
      setPreview({
        title: data.title,
        company: data.company,
        thumbnailUrl: data.thumbnailUrl,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "미리보기를 가져오지 못했어요");
    } finally {
      setIsFetchingPreview(false);
    }
  };

  const allNotesFilled = Object.values(notes).every((v) => v.trim().length >= 20);
  const canSubmit = url && category && preview && allNotesFilled;

  const handleSaveDraft = async () => {
    setIsSavingDraft(true);
    setError(null);
    try {
      const res = await fetch("/api/drafts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: draftId,
          data: { url, category, tagsInput, preview, notes },
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "임시저장에 실패했어요");
      setDraftId(data.draft.id);
      setDraftSavedAt(Date.now());
    } catch (e) {
      setError(e instanceof Error ? e.message : "임시저장에 실패했어요");
    } finally {
      setIsSavingDraft(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit || !preview) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/articles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          category,
          title: preview.title,
          company: preview.company,
          thumbnailUrl: preview.thumbnailUrl,
          tags: tagsInput
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean),
          ...notes,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "등록에 실패했어요");
      if (draftId) await fetch(`/api/drafts/${draftId}`, { method: "DELETE" });
      router.push(`/articles/${data.id}`);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "등록에 실패했어요");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-4">
      <div className="grid gap-2">
        <Label>카테고리</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setCategory(c)}
              className={cn(
                "rounded-full border px-3 py-2 text-sm",
                category === c
                  ? "bg-primary text-primary-foreground border-primary"
                  : "text-muted-foreground",
              )}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-2">
        <Label htmlFor="url">원문 URL</Label>
        <div className="flex gap-2">
          <Input
            id="url"
            type="url"
            placeholder="https://techblog.example.com/post/1"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setPreview(null);
            }}
            required
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleFetchPreview}
            disabled={!url || isFetchingPreview}
          >
            {isFetchingPreview ? "가져오는 중…" : "미리보기"}
          </Button>
        </div>
        {preview ? (
          <div className="mt-1 flex items-center gap-3 rounded-lg border p-3">
            <div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-muted">
              {preview.thumbnailUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{preview.title}</p>
              <p className="text-xs text-muted-foreground">{preview.company}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-2">
        <Label htmlFor="tags">태그 (쉼표로 구분, 선택)</Label>
        <Input
          id="tags"
          placeholder="예: MSA, Kubernetes"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
        />
      </div>

      {NOTE_FIELDS.map(({ key, label, placeholder }) => (
        <div className="grid gap-2" key={key}>
          <Label htmlFor={key}>
            {label} <span className="text-destructive">*</span>
          </Label>
          <textarea
            id={key}
            className="min-h-24 rounded-md border bg-background p-3 text-sm"
            placeholder={placeholder}
            value={notes[key]}
            onChange={(e) => setNotes((prev) => ({ ...prev, [key]: e.target.value }))}
          />
          <p className="text-xs text-muted-foreground">
            {notes[key].trim().length}/20자 이상
          </p>
        </div>
      ))}

      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {draftSavedAt ? (
        <p className="text-xs text-muted-foreground">임시저장했어요. 마이 탭에서 이어 쓸 수 있어요.</p>
      ) : null}

      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1"
          disabled={isSavingDraft}
          onClick={handleSaveDraft}
        >
          {isSavingDraft ? "저장 중…" : "임시저장"}
        </Button>
        <Button type="submit" disabled={!canSubmit || isSubmitting} size="lg" className="flex-1">
          {isSubmitting ? "등록 중…" : "등록 완료"}
        </Button>
      </div>
    </form>
  );
}
