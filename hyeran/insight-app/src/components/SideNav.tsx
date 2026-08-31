"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Icon from "@/components/Icon";

const NAV = [
  { href: "/home", label: "홈", icon: "home" },
  { href: "/feed", label: "피드", icon: "feed" },
  { href: "/insight", label: "인사이트", icon: "insight" },
  { href: "/search", label: "검색", icon: "search" },
  { href: "/notifications", label: "알림", icon: "bell" },
  { href: "/my", label: "마이", icon: "user" },
];

// 데스크톱 전용 좌측 네비 (모바일에선 CSS로 숨김, 하단 탭바 사용)
export default function SideNav() {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/auth")) return null; // 로그인 화면 제외

  return (
    <nav className="sidenav">
      <div className="sidenav-logo"><span className="name">INSIGHT</span><span className="dot">.</span></div>
      {NAV.map((n) => {
        const on = pathname === n.href;
        return (
          <Link key={n.href} href={n.href} className={`sidenav-item ${on ? "on" : ""}`}>
            <Icon name={n.icon} /><span>{n.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
