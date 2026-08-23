"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CommentRecord } from "@/lib/db/comments";
import { useState } from "react";

function formatTime(iso: string) {
  return new Date(iso).toLocaleString("ko-KR", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function CommentSection({
  articleId,
  initialComments,
  askAuthorName,
}: {
  articleId: string;
  initialComments: CommentRecord[];
  askAuthorName: boolean;
}) {
  const [comments, setComments] = useState(initialComments);
  const [authorName, setAuthorName] = useState("");
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyBody, setReplyBody] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesOf = (id: string) => comments.filter((c) => c.parent_id === id);

  const submit = async (parentId: string | null, text: string, reset: () => void) => {
    if (!text.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/articles/${articleId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text, parentId, authorName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setComments((prev) => [...prev, data.comment]);
      reset();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="p-4">
      <h2 className="mb-3 text-sm font-semibold">댓글 {comments.length}</h2>

      {askAuthorName ? (
        <Input
          className="mb-2"
          placeholder="닉네임 (미리보기 모드)"
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
        />
      ) : null}

      <div className="flex gap-2">
        <Input
          placeholder="댓글을 남겨보세요"
          value={body}
          onChange={(e) => setBody(e.target.value)}
        />
        <Button
          type="button"
          disabled={isSubmitting}
          onClick={() => submit(null, body, () => setBody(""))}
        >
          등록
        </Button>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {topLevel.map((c) => (
          <div key={c.id} className="border-b pb-3">
            <div className="flex items-baseline gap-2 text-sm">
              <span className="font-medium">{c.author_name}</span>
              <span className="text-xs text-muted-foreground">{formatTime(c.created_at)}</span>
            </div>
            <p className="mt-1 text-sm">{c.body}</p>
            <button
              className="mt-1 text-xs text-muted-foreground underline"
              onClick={() => setReplyTo(replyTo === c.id ? null : c.id)}
            >
              답글
            </button>

            {repliesOf(c.id).map((r) => (
              <div key={r.id} className="ml-4 mt-2 border-l pl-3">
                <div className="flex items-baseline gap-2 text-sm">
                  <span className="font-medium">{r.author_name}</span>
                  <span className="text-xs text-muted-foreground">{formatTime(r.created_at)}</span>
                </div>
                <p className="mt-1 text-sm">{r.body}</p>
              </div>
            ))}

            {replyTo === c.id ? (
              <div className="ml-4 mt-2 flex gap-2">
                <Input
                  placeholder="답글을 남겨보세요"
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                />
                <Button
                  type="button"
                  size="sm"
                  disabled={isSubmitting}
                  onClick={() =>
                    submit(c.id, replyBody, () => {
                      setReplyBody("");
                      setReplyTo(null);
                    })
                  }
                >
                  등록
                </Button>
              </div>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
