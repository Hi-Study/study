import { Sparkles } from "lucide-react";

import { SummarizeButton } from "@/components/summarize-button";

// AI 요약과 사람이 쓴 독후감이 나란히 같은 박스 스타일(border p-4)로 보이면
// 어떤 게 AI 생성인지 한눈에 구분이 안 된다. accent 톤 배경 + 원형 AI 배지로
// "이건 AI가 만든 요약"이라는 걸 시각적으로 분리한다.
export function AiSummaryCard({
  articleId,
  status,
  problem,
  solution,
  takeaway,
}: {
  articleId: string;
  status: string | null;
  problem: string | null;
  solution: string | null;
  takeaway: string | null;
}) {
  return (
    <div className="mt-4 rounded-2xl border border-accent bg-accent/50 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <p className="text-sm font-semibold">AI 요약</p>
        </div>
        {status === "ready" ? (
          <SummarizeButton
            articleId={articleId}
            variant="link"
            label="다시 요약하기"
            loadingLabel="다시 생성 중…"
          />
        ) : null}
      </div>
      {status === "ready" && problem ? (
        <div className="flex flex-col gap-3 text-sm">
          <div>
            <p className="font-medium">무슨 문제를 다뤘나?</p>
            <p className="text-muted-foreground">{problem}</p>
          </div>
          <div>
            <p className="font-medium">어떻게 해결했나?</p>
            <p className="text-muted-foreground">{solution}</p>
          </div>
          <div>
            <p className="font-medium">디자이너·PM 관점에서 무엇을 배울 수 있나?</p>
            <p className="text-muted-foreground">{takeaway}</p>
          </div>
        </div>
      ) : (
        <div>
          <p className="text-sm text-muted-foreground">
            아직 요약이 없어요. 아래 버튼으로 생성해보세요 (Gemini API 키 필요).
          </p>
          <div className="mt-2">
            <SummarizeButton articleId={articleId} />
          </div>
        </div>
      )}
    </div>
  );
}
