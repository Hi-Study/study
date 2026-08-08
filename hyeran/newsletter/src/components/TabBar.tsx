"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "./Icon";

const TABS = [
  { href: "/home", label: "홈", icon: "home" as const },
  { href: "/search", label: "검색", icon: "search" as const },
  { href: "/my", label: "마이", icon: "user" as const },
];

export default function TabBar() {
  const pathname = usePathname();

  return (
    <nav id="tabbar">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          className={`tab-btn${pathname === tab.href ? " active" : ""}`}
        >
          <Icon name={tab.icon} />
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
