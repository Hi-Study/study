import { ROLE_META, ROLES, type Role } from "@/core/3-place/onboarding";
import { RoleIcon } from "./RoleIcon";

export function RoleStep({ selected, onSelect }: { selected: Role | null; onSelect: (role: Role) => void }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">어떤 일을 하고 계신가요?</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">같은 기술도 하는 일에 따라 발견할 수 있는 인사이트가 달라요.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        {ROLES.map((role) => {
          const active = selected === role;
          return (
            <button
              key={role}
              onClick={() => onSelect(role)}
              aria-pressed={active}
              className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition ${
                active ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-ink-3"
              }`}
            >
              <span className={`flex size-9 items-center justify-center rounded-full ${active ? "bg-brand text-white" : "bg-bg text-ink-2"}`}>
                <RoleIcon role={role} className="size-5" />
              </span>
              <span className="font-bold leading-snug text-ink">{ROLE_META[role].label}</span>
              <span className="text-xs leading-snug text-ink-3">{ROLE_META[role].valueProp}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
