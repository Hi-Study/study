import { cn } from "@/lib/utils";
import Link from "next/link";

export type UnderlineTabItem = {
  key: string;
  label: string;
  href: string;
  active: boolean;
};

// 언더라인 탭(DESIGN.md 3장 공통 패턴) — 도서정보/리뷰밑줄, 리뷰/밑줄 등 중첩 탭에도 그대로 쓴다.
export function UnderlineTabs({ items, className }: { items: UnderlineTabItem[]; className?: string }) {
  return (
    <div className={cn("no-scrollbar flex gap-4 overflow-x-auto", className)}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          className={cn(
            "shrink-0 whitespace-nowrap border-b-2 pb-3 text-sm font-medium",
            item.active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
