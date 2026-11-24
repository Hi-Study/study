/** 4단계 진행바 — NewArticlesHero.tsx 의 진행바 패턴(h-1 rounded-full bg-line 트랙)을 그대로 쓴다 */
export function OnboardingProgress({ step, total = 4 }: { step: number; total?: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={step}>
        <span
          className="absolute inset-y-0 left-0 rounded-full bg-brand transition-all duration-300"
          style={{ width: `${(step / total) * 100}%` }}
        />
      </div>
      <span className="shrink-0 text-xs font-semibold text-ink-3">
        {step}/{total}
      </span>
    </div>
  );
}
