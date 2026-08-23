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

export type SortOption = { key: string; label: string; href: string };

export function SortDropdown({ options, active }: { options: SortOption[]; active: string }) {
  const current = options.find((o) => o.key === active) ?? options[0];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex shrink-0 items-center gap-1 rounded-full border px-3 py-1.5 text-sm text-muted-foreground">
        {current.label}
        <ChevronDown className="h-3.5 w-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map((option) => (
          <DropdownMenuItem key={option.key} asChild>
            <Link href={option.href} className={cn(option.key === active && "font-semibold text-primary")}>
              {option.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
