"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "홈", icon: "⌂" },
  { href: "/feed", label: "피드", icon: "☰" },
  { href: "/search", label: "검색", icon: "⌕" },
  { href: "/my", label: "마이", icon: "☺" },
];

export function NavTabs({ variant }: { variant: "top" | "bottom" }) {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  if (variant === "top")
    return (
      <nav className="hidden gap-1 md:flex">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`rounded-lg px-3 py-1.5 text-[15px] font-medium transition ${
              active(t.href) ? "bg-brand-soft text-brand" : "text-ink-2 hover:bg-bg"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </nav>
    );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
      <div className="grid grid-cols-4">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
              active(t.href) ? "text-brand" : "text-ink-3"
            }`}
          >
            <span className="text-lg leading-none">{t.icon}</span>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
