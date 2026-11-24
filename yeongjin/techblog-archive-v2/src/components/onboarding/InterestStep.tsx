import { ROLE_INTERESTS, type Role } from "@/core/3-place/onboarding";

export function InterestStep({
  role,
  selected,
  onToggle,
  onNext,
}: {
  role: Role;
  selected: string[];
  onToggle: (id: string) => void;
  onNext: () => void;
}) {
  const interests = ROLE_INTERESTS[role];
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">요즘 어떤 인사이트가 필요하세요?</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">관심 있는 주제를 골라주시면 관련 사례를 먼저 보여드릴게요.</p>

      <div className="mt-8 flex flex-wrap gap-2">
        {interests.map((interest) => {
          const active = selected.includes(interest.id);
          return (
            <button
              key={interest.id}
              onClick={() => onToggle(interest.id)}
              aria-pressed={active}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                active ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink"
              }`}
            >
              {active && "✓ "}
              {interest.label}
            </button>
          );
        })}
      </div>

      <button
        onClick={onNext}
        className="mt-10 flex h-14 w-full items-center justify-center rounded-full bg-brand text-[17px] font-bold text-white transition hover:brightness-110"
      >
        선택한 관점으로 시작하기
      </button>
    </div>
  );
}
