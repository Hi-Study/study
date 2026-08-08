"use client";

import Link from "next/link";
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
  const showFab = ["/home", "/feed", "/insight"].includes(pathname);

  return (
    <>
      {showFab && (
        <button className="fab" onClick={() => router.push("/register")} aria-label="글 등록">
          <Icon name="plus" size="lg" />
        </button>
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
