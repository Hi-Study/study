"use client";

import Link from "next/link";
import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Icon from "@/components/Icon";

const TABS = [
  { href: "/home", label: "홈", icon: "home" },
  { href: "/feed", label: "피드", icon: "feed" },
  { href: "/insight", label: "인사이트", icon: "insight" },
  { href: "/my", label: "마이", icon: "user" },
];

export default function TabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const showFab = pathname === "/insight"; // v3.0: FAB는 인사이트 탭에만

  const go = (href: string) => { setMenu(false); router.push(href); };

  return (
    <>
      {showFab && (
        <>
          {menu && <div className="scrim show" onClick={() => setMenu(false)} />}
          {menu && (
            <div className="fab-menu">
              <button onClick={() => go("/register")}><Icon name="review" size="sm" /> 아티클 등록</button>
              <button onClick={() => go("/community/new")}><Icon name="edit" size="sm" /> 자유글 작성</button>
            </div>
          )}
          <button className={`fab${menu ? " open" : ""}`} onClick={() => setMenu((v) => !v)} aria-label="글 작성">
            <Icon name={menu ? "x" : "plus"} size="lg" />
          </button>
        </>
      )}
      <nav className="tabbar">
        {TABS.map((t) => (
          <Link key={t.href} href={t.href} className={`tab ${pathname === t.href ? "on" : ""}`}>
            <Icon name={t.icon} />
            <span className="lbl">{t.label}</span>
          </Link>
        ))}
      </nav>
    </>
  );
}
