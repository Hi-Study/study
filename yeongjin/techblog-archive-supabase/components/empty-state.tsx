import Link from "next/link";

import { Button } from "@/components/ui/button";

// 화면마다 따로 있던 "아직 ~ 없어요" 안내문을 통일. 다음 행동이 있는 경우
// (글 등록 등)에는 CTA 버튼까지 같이 보여줘서 안내에서 끝나지 않게 한다.
export function EmptyState({
  message,
  actionLabel,
  actionHref,
}: {
  message: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      {actionLabel && actionHref ? (
        <Button asChild variant="cta" size="sm">
          <Link href={actionHref}>{actionLabel}</Link>
        </Button>
      ) : null}
    </div>
  );
}
