"use client";

import { cn } from "@/lib/utils";
import { Home, MessagesSquare, Rss, Search, User } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home", label: "홈", icon: Home },
  { href: "/feed", label: "피드", icon: Rss },
  { href: "/discussion", label: "토론", icon: MessagesSquare },
  { href: "/search", label: "검색", icon: Search },
  { href: "/my", label: "마이", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
      <div className="mx-auto flex max-w-xl">
        {TABS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-1 flex-col items-center gap-1 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] text-xs",
                active ? "font-medium text-primary" : "text-muted-foreground",
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
