"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** 하단 탭바 아이콘 — 글자 기호는 기기마다 이모지처럼 보여서 선 아이콘(SVG)으로 그린다 */
const ICON_PATH: Record<string, string> = {
  "/": "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z",
  "/feed": "M5 6h14M5 12h14M5 18h9",
  "/search": "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4.2-4.2",
  "/my": "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0",
};

const TABS = [
  { href: "/", label: "홈" },
  { href: "/feed", label: "피드" },
  { href: "/search", label: "검색" },
  { href: "/my", label: "마이" },
];

/** 하단 탭바 — PC·모바일 공통. 넓은 화면에서도 탭이 양 끝으로 흩어지지 않게 가운데(max-w-md)에 모은다 */
export function NavTabs() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <nav
      aria-label="주요 메뉴"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur"
    >
      <div className="mx-auto grid max-w-md grid-cols-4">
        {TABS.map((t) => (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active(t.href) ? "page" : undefined}
            className={`flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition hover:text-brand ${
              active(t.href) ? "text-brand" : "text-ink-3"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              aria-hidden
              className="size-[22px]"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.9}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d={ICON_PATH[t.href]} />
            </svg>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
