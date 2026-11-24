import type { Role } from "@/core/3-place/onboarding";

/** 직군 아이콘 — 라이브러리 없이 선 아이콘으로 직접 그린다(NavTabs.tsx 와 같은 스타일: stroke=currentColor) */
const PATH: Record<Role, string> = {
  PLANNER: "M8 3h8v3H8V3zM5 6h14v15H5V6zM9 11h6M9 15h6",
  DESIGNER: "M4 20l1-4L15 6l3 3L8 19l-4 1zM14 7l3 3",
  DEVELOPER: "M9 6L3 12l6 6M15 6l6 6-6 6",
  STRATEGY: "M4 18l5-6 4 3 7-9M15 6h5v5",
  MARKETER: "M3 10v4a1 1 0 0 0 1 1h2l10 5V4L6 9H4a1 1 0 0 0-1 1zM17 9.5a3 3 0 0 1 0 5",
  LEARNER: "M12 4L3 8l9 4 9-4-9-4zM3 8v7M21 8v7M7 11.5v4a5 5 0 0 0 10 0v-4",
};

export function RoleIcon({ role, className = "size-6" }: { role: Role; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden className={className} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      <path d={PATH[role]} />
    </svg>
  );
}
