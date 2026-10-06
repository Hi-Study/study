"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { addFront, clearList, useLocalList } from "@/core/shared/local-store";

export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const recent = useLocalList<string>("recent-search");

  // 검색어가 바뀌면 page 쪽에서 key 로 다시 마운트되므로 q 를 따로 맞출 필요가 없다
  useEffect(() => {
    if (initial) addFront("recent-search", initial, 10);
  }, [initial]);

  const go = (v: string) => {
    const t = v.trim();
    if (t) router.push(`/search?q=${encodeURIComponent(t)}`);
  };

  return (
    <div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          go(q);
        }}
        className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-3 focus-within:border-brand"
      >
        <span className="text-ink-3">⌕</span>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="문제, 경험, 기술, 회사로 찾아보세요"
          className="flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
          aria-label="검색어"
        />
        {q && (
          <button type="button" onClick={() => setQ("")} className="text-ink-3" aria-label="지우기">
            ×
          </button>
        )}
      </form>
      {recent.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-ink-3">최근 검색</span>
          {recent.map((r) => (
            <button key={r} onClick={() => go(r)} className="rounded-full bg-surface px-3 py-1 text-sm text-ink-2 hover:text-brand">
              {r}
            </button>
          ))}
          <button onClick={() => clearList("recent-search")} className="text-xs text-ink-3 underline">
            지우기
          </button>
        </div>
      )}
    </div>
  );
}
