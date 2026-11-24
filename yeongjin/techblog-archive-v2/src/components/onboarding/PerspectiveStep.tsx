import { ArticleCard } from "@/components/common/ArticleCard";
import { ROLE_META, ROLE_PERSPECTIVE_QUESTION, ROLES, type Role } from "@/core/3-place/onboarding";
import type { ArticleRow } from "@/core/shared/types";

export function PerspectiveStep({
  article,
  viewRole,
  onSwitch,
  onNext,
}: {
  article: ArticleRow | null;
  viewRole: Role;
  onSwitch: (role: Role) => void;
  onNext: () => void;
}) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">{ROLE_META[viewRole].title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">{ROLE_META[viewRole].description}</p>

      {article && (
        <div className="mt-6">
          <ArticleCard a={article} />
          <div className="mt-3 rounded-2xl bg-brand-soft p-4">
            <p className="text-xs font-semibold text-brand">이런 관점으로 읽을 수 있어요</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink">{ROLE_PERSPECTIVE_QUESTION[viewRole]}</p>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs font-semibold text-ink-3">다른 직군이면 같은 글을 이렇게도 봐요</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {ROLES.map((role) => (
          <button
            key={role}
            onClick={() => onSwitch(role)}
            aria-pressed={viewRole === role}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              viewRole === role ? "bg-ink text-white" : "bg-surface text-ink-2 ring-1 ring-line hover:text-ink"
            }`}
          >
            {ROLE_META[role].label}
          </button>
        ))}
      </div>

      <button
        onClick={onNext}
        className="mt-10 flex h-14 w-full items-center justify-center rounded-full bg-brand text-[17px] font-bold text-white transition hover:brightness-110"
      >
        내 관심사에 맞는 콘텐츠 만나기
      </button>
    </div>
  );
}
