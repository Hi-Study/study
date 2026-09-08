"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

// 핵심 사용자 행동은 "글을 많이 보는 것"이다.
// 인사이트·직접 등록은 부수 기능이라 탭에서 뺐다 (마이에서 들어간다).
const TABS = [
  { href: "/home", label: "홈", icon: "home" },
  { href: "/feed", label: "피드", icon: "feed" },
  { href: "/bookmarks", label: "북마크", icon: "bookmark" },
  { href: "/my", label: "마이", icon: "user" },
];

export default function TabBar() {
  const pathname = usePathname();
  return (
    <nav className="tabbar">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={`tab ${pathname === t.href ? "on" : ""}`}>
          <Icon name={t.icon} />
          <span className="lbl">{t.label}</span>
        </Link>
      ))}
    </nav>
  );
}
