"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

// 데스크톱 전용 좌측 네비. 하단 탭바와 같은 4개 + 검색
const NAV = [
  { href: "/home", label: "홈", icon: "home" },
  { href: "/feed", label: "피드", icon: "feed" },
  { href: "/bookmarks", label: "북마크", icon: "bookmark" },
  { href: "/my", label: "마이", icon: "user" },
  { href: "/search", label: "검색", icon: "search" },
];

export default function SideNav() {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/auth")) return null; // 로그인 화면 제외

  return (
    <nav className="sidenav">
      <div className="sidenav-logo"><span className="name">INSIGHT</span><span className="dot">.</span></div>
      {NAV.map((n) => (
        <Link key={n.href} href={n.href} className={`sidenav-item ${pathname === n.href ? "on" : ""}`}>
          <Icon name={n.icon} /><span>{n.label}</span>
        </Link>
      ))}
    </nav>
  );
}
