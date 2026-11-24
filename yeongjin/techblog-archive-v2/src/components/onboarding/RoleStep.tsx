import { ROLE_META, ROLES, type Role } from "@/core/3-place/onboarding";
import { Blob } from "./Blob";
import { RoleIcon } from "./RoleIcon";

export function RoleStep({ selected, onSelect }: { selected: Role | null; onSelect: (role: Role) => void }) {
  return (
    <div>
      <h1 className="text-2xl font-bold tracking-tight">어떤 일을 하고 계신가요?</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-3">같은 기술도 하는 일에 따라 발견할 수 있는 인사이트가 달라요.</p>

      <div className="mt-8 grid grid-cols-2 gap-3 md:grid-cols-3">
        {ROLES.map((role, i) => {
          const active = selected === role;
          return (
            <button
              key={role}
              onClick={() => onSelect(role)}
              aria-pressed={active}
              className={`flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition duration-200 active:scale-95 ${
                active ? "border-brand bg-brand-soft" : "border-line bg-surface hover:border-ink-3"
              }`}
            >
              <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-full">
                <Blob
                  variant="breathe"
                  delay={-i * 0.7}
                  from={active ? "#ff8a68" : "#dfe3e8"}
                  to={active ? "var(--brand)" : "#c6cbd1"}
                  className="absolute inset-0"
                />
                <RoleIcon role={role} className={`relative size-6 transition-colors duration-300 ${active ? "text-white" : "text-ink-2"}`} />
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
