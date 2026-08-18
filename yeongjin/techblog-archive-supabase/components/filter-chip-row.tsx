"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown } from "lucide-react";
import Link from "next/link";

import { cn } from "@/lib/utils";

export type FilterChipItem = {
  key: string;
  label: string;
  href: string;
  selected: boolean;
  logoUrl?: string;
};

// 홈(기업 칩)·피드(기업 필터)에서 각자 구현하던 필터 칩을 공통화.
// 선택 상태는 검정(bg-foreground)이 아니라 primary를 써서 "지금 선택된 것"이
// 앱 전체의 강조색과 같은 의미로 읽히게 한다 (DESIGN.md 2.1).
// overflowItems가 있으면 "칩 과다" 문제(PRD 10.2)에 대응해 나머지는 드롭다운으로 뺀다.
export function FilterChipRow({
  items,
  overflowItems,
  overflowLabel = "더보기",
  className,
}: {
  items: FilterChipItem[];
  overflowItems?: FilterChipItem[];
  overflowLabel?: string;
  className?: string;
}) {
  const overflowSelected = overflowItems?.some((item) => item.selected) ?? false;

  return (
    <div className={cn("no-scrollbar flex gap-2 overflow-x-auto pb-1", className)}>
      {items.map((item) => (
        <Link
          key={item.key}
          href={item.href}
          aria-pressed={item.selected}
          className={cn(
            "flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors",
            item.selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
          )}
        >
          {item.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.logoUrl} alt="" className="h-4 w-4 shrink-0 rounded-full object-contain" />
          ) : null}
          {item.label}
        </Link>
      ))}

      {overflowItems && overflowItems.length > 0 ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            className={cn(
              "flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm transition-colors",
              overflowSelected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-input text-muted-foreground hover:bg-accent hover:text-accent-foreground",
            )}
          >
            {overflowLabel}
            <ChevronDown className="h-3.5 w-3.5" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
            {overflowItems.map((item) => (
              <DropdownMenuItem key={item.key} asChild>
                <Link href={item.href} className={cn(item.selected && "font-semibold text-primary")}>
                  {item.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </div>
  );
}
