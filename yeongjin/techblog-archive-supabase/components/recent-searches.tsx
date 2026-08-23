"use client";

import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import { useEffect, useState } from "react";

const STORAGE_KEY = "techarchive:recent-searches";
const MAX_ITEMS = 8;

function readStored(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

// 최근 검색어(PRD v0.2 4.7)는 계정이 아니라 이 브라우저 기기에 귀속되는 값이라 localStorage에만 둔다.
// visible=false여도 currentQuery는 기록해야 해서(검색 실행 시점), 목록만 숨긴다.
export function RecentSearches({
  currentQuery,
  visible = true,
}: {
  currentQuery?: string;
  visible?: boolean;
}) {
  const [items, setItems] = useState<string[]>([]);

  useEffect(() => {
    let list = readStored();
    if (currentQuery && currentQuery.trim()) {
      const q = currentQuery.trim();
      list = [q, ...list.filter((v) => v !== q)].slice(0, MAX_ITEMS);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }
    setItems(list);
  }, [currentQuery]);

  if (!visible || items.length === 0) return null;

  const clear = () => {
    localStorage.removeItem(STORAGE_KEY);
    setItems([]);
  };

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">최근 검색어</h2>
        <button type="button" onClick={clear} className="text-xs text-muted-foreground underline">
          전체 삭제
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-2">
        {items.map((q) => (
          <Link key={q} href={`/search?q=${encodeURIComponent(q)}`}>
            <Badge variant="outline">{q}</Badge>
          </Link>
        ))}
      </div>
    </div>
  );
}
