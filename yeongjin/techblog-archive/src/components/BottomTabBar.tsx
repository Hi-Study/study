"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/explore", label: "탐색", icon: "🧭" },
  { href: "/curation", label: "큐레이션", icon: "✨" },
  { href: "/search", label: "검색", icon: "🔍" },
  { href: "/my", label: "마이", icon: "👤" },
] as const;

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-neutral-200 bg-white/95 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95">
      <div className="mx-auto grid max-w-2xl grid-cols-4">
        {TABS.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors ${
                active ? "text-primary" : "text-neutral-400 dark:text-neutral-500"
              }`}
            >
              <span className="text-lg">{tab.icon}</span>
              <span className={active ? "font-semibold" : ""}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
